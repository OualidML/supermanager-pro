import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, language } = await req.json()
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY secret not found in Supabase secrets.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const systemPrompt = `You are a helpful assistant for the SuperManager Pro app. You can ONLY answer questions about how to use this app (e.g. how to add products, record sales, check reports, log expenses, and read demand forecasts). Keep your answers extremely brief, clear, and focused on layout instructions. The user's active language is "${language || 'en'}". You MUST respond in this language.`

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: message }],
        system: systemPrompt,
        stream: true
      })
    })

    // If Anthropic returned an error (e.g. invalid key, quota exceeded)
    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text()
      console.error('Anthropic API Error:', errText)
      return new Response(`Anthropic API Error: ${errText}`, {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain',
        }
      })
    }

    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const reader = anthropicResponse.body?.getReader()
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No readable body returned from Anthropic stream channel.')
    }

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'))
          
          for (const line of lines) {
            try {
              const jsonStr = line.replace('data:', '').trim()
              const parsed = JSON.parse(jsonStr)
              
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                await writer.write(encoder.encode(parsed.delta.text))
              }
            } catch (e) {
              // Ignore partial chunk parsing errors
            }
          }
        }
      } catch (e) {
        console.error('Error during streaming delta segments:', e)
      } finally {
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
