using System;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Threading;

namespace SuperManagerLauncher
{
    class Program
    {
        static HttpListener listener;
        static string baseDirectory;

        static void Main(string[] args)
        {
            baseDirectory = AppDomain.CurrentDomain.BaseDirectory;
            string distPath = Path.Combine(baseDirectory, "dist");

            if (!Directory.Exists(distPath))
            {
                distPath = baseDirectory;
            }

            int port = 4173;
            bool started = false;

            while (!started && port < 4200)
            {
                try
                {
                    listener = new HttpListener();
                    listener.Prefixes.Add("http://localhost:" + port + "/");
                    listener.Prefixes.Add("http://127.0.0.1:" + port + "/");
                    listener.Start();
                    started = true;
                }
                catch
                {
                    port++;
                }
            }

            if (!started)
            {
                // Fallback to simple 127.0.0.1
                try
                {
                    listener = new HttpListener();
                    listener.Prefixes.Add("http://127.0.0.1:8088/");
                    listener.Start();
                    port = 8088;
                    started = true;
                }
                catch
                {
                    return;
                }
            }

            // Launch browser to the app
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "http://127.0.0.1:" + port + "/",
                    UseShellExecute = true
                });
            }
            catch { }

            // Serve incoming HTTP requests
            ThreadPool.QueueUserWorkItem((o) =>
            {
                while (listener != null && listener.IsListening)
                {
                    try
                    {
                        var context = listener.GetContext();
                        ThreadPool.QueueUserWorkItem((c) => ProcessRequest((HttpListenerContext)c, distPath), context);
                    }
                    catch
                    {
                        break;
                    }
                }
            });

            // Keep alive
            while (true)
            {
                Thread.Sleep(10000);
            }
        }

        static void ProcessRequest(HttpListenerContext context, string distPath)
        {
            try
            {
                string rawPath = context.Request.Url.LocalPath.TrimStart('/');
                if (string.IsNullOrEmpty(rawPath))
                {
                    rawPath = "index.html";
                }

                string filePath = Path.Combine(distPath, rawPath.Replace('/', Path.DirectorySeparatorChar));

                // SPA fallback: If file does not exist or has no extension, serve index.html
                if (!File.Exists(filePath) || !Path.HasExtension(filePath))
                {
                    filePath = Path.Combine(distPath, "index.html");
                }

                if (File.Exists(filePath))
                {
                    byte[] buffer = File.ReadAllBytes(filePath);
                    context.Response.ContentLength64 = buffer.Length;

                    string ext = Path.GetExtension(filePath).ToLowerInvariant();
                    switch (ext)
                    {
                        case ".html":
                            context.Response.ContentType = "text/html; charset=utf-8";
                            break;
                        case ".js":
                            context.Response.ContentType = "application/javascript; charset=utf-8";
                            break;
                        case ".css":
                            context.Response.ContentType = "text/css; charset=utf-8";
                            break;
                        case ".json":
                            context.Response.ContentType = "application/json; charset=utf-8";
                            break;
                        case ".png":
                            context.Response.ContentType = "image/png";
                            break;
                        case ".jpg":
                        case ".jpeg":
                            context.Response.ContentType = "image/jpeg";
                            break;
                        case ".svg":
                            context.Response.ContentType = "image/svg+xml";
                            break;
                        case ".ico":
                            context.Response.ContentType = "image/x-icon";
                            break;
                        case ".woff":
                        case ".woff2":
                            context.Response.ContentType = "font/woff2";
                            break;
                        default:
                            context.Response.ContentType = "application/octet-stream";
                            break;
                    }

                    context.Response.StatusCode = (int)HttpStatusCode.OK;
                    context.Response.OutputStream.Write(buffer, 0, buffer.Length);
                }
                else
                {
                    context.Response.StatusCode = (int)HttpStatusCode.NotFound;
                }
            }
            catch { }
            finally
            {
                try
                {
                    context.Response.OutputStream.Close();
                }
                catch { }
            }
        }
    }
}
