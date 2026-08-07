import socket

host = "aws-0-eu-west-3.pooler.supabase.com"
ports = [5432, 6543]

def main():
    print(f"Testing connection to {host}:")
    for port in ports:
        try:
            s = socket.create_connection((host, port), timeout=5)
            print(f"Successfully connected to port {port}")
            s.close()
        except Exception as e:
            print(f"Failed to connect to port {port}: {e}")

if __name__ == "__main__":
    main()
