using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Diagnostics;

namespace SuperManagerLauncher
{
    class Program
    {
        static TcpListener server;
        static string distPath;

        static void Main(string[] args)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            distPath = Path.Combine(baseDir, "dist");
            if (!Directory.Exists(distPath))
            {
                distPath = baseDir;
            }

            int port = 5050;
            bool bound = false;

            for (int p = 5050; p <= 5100; p++)
            {
                try
                {
                    server = new TcpListener(IPAddress.Loopback, p);
                    server.Start();
                    port = p;
                    bound = true;
                    break;
                }
                catch
                {
                    // Try next port
                }
            }

            if (!bound) return;

            string url = "http://127.0.0.1:" + port + "/";
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = url,
                    UseShellExecute = true
                });
            }
            catch { }

            while (true)
            {
                try
                {
                    TcpClient client = server.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(HandleClient, client);
                }
                catch
                {
                    Thread.Sleep(50);
                }
            }
        }

        static void HandleClient(object obj)
        {
            TcpClient client = (TcpClient)obj;
            try
            {
                using (NetworkStream stream = client.GetStream())
                {
                    stream.ReadTimeout = 4000;
                    stream.WriteTimeout = 10000;

                    byte[] buffer = new byte[4096];
                    int bytesRead = stream.Read(buffer, 0, buffer.Length);
                    if (bytesRead <= 0) return;

                    string requestStr = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                    string[] lines = requestStr.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
                    if (lines.Length == 0) return;

                    string[] requestParts = lines[0].Split(' ');
                    if (requestParts.Length < 2) return;

                    string rawUrl = requestParts[1].Split('?')[0].TrimStart('/');
                    if (string.IsNullOrEmpty(rawUrl))
                    {
                        rawUrl = "index.html";
                    }

                    string filePath = Path.Combine(distPath, rawUrl.Replace('/', Path.DirectorySeparatorChar));

                    // SPA routing: If file does not exist or has no file extension, serve index.html
                    if (!File.Exists(filePath) || !Path.HasExtension(filePath))
                    {
                        filePath = Path.Combine(distPath, "index.html");
                    }

                    if (File.Exists(filePath))
                    {
                        FileInfo fi = new FileInfo(filePath);
                        long fileLength = fi.Length;
                        string contentType = GetContentType(filePath);

                        string header = "HTTP/1.1 200 OK\r\n" +
                                        "Content-Type: " + contentType + "\r\n" +
                                        "Content-Length: " + fileLength + "\r\n" +
                                        "Access-Control-Allow-Origin: *\r\n" +
                                        "Cache-Control: public, max-age=3600\r\n" +
                                        "Connection: close\r\n\r\n";

                        byte[] headerBytes = Encoding.UTF8.GetBytes(header);
                        stream.Write(headerBytes, 0, headerBytes.Length);

                        // Stream file in chunks
                        using (FileStream fs = File.OpenRead(filePath))
                        {
                            byte[] chunk = new byte[65536];
                            int read;
                            while ((read = fs.Read(chunk, 0, chunk.Length)) > 0)
                            {
                                stream.Write(chunk, 0, read);
                            }
                        }
                        stream.Flush();
                    }
                    else
                    {
                        string notFound = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                        byte[] notFoundBytes = Encoding.UTF8.GetBytes(notFound);
                        stream.Write(notFoundBytes, 0, notFoundBytes.Length);
                    }
                }
            }
            catch { }
            finally
            {
                try { client.Close(); } catch { }
            }
        }

        static string GetContentType(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            switch (ext)
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js": return "application/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".png": return "image/png";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".svg": return "image/svg+xml";
                case ".ico": return "image/x-icon";
                case ".woff": return "font/woff";
                case ".woff2": return "font/woff2";
                default: return "application/octet-stream";
            }
        }
    }
}
