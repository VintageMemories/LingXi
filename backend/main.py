"""
灵析 (Lingxi) - 领域通用智能体框架
Domain-General Agent Framework

Run this file directly: python main.py
Or with uv: uv run main.py
"""

import uvicorn
import os
import sys
import platform

# ---------------------------------------------------------------------------
# 确保 backend 目录在 sys.path 和工作目录中
# ---------------------------------------------------------------------------
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

os.chdir(_BACKEND_DIR)


def generate_self_signed_cert():
    """Generate a self-signed SSL certificate if one doesn't exist."""
    cert_file = os.path.join(_BACKEND_DIR, "data", "cert.pem")
    key_file = os.path.join(_BACKEND_DIR, "data", "key.pem")

    if os.path.exists(cert_file) and os.path.exists(key_file):
        return cert_file, key_file

    os.makedirs(os.path.join(_BACKEND_DIR, "data"), exist_ok=True)

    # Method 1: Try Python's cryptography library
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import datetime

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Lingxi"),
        ])
        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.utcnow())
            .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=365))
            .add_extension(
                x509.SubjectAlternativeName([
                    x509.DNSName("localhost"),
                    x509.IPAddress(__import__("ipaddress").IPv4Address("127.0.0.1")),
                ]),
                critical=False,
            )
            .sign(key, hashes.SHA256())
        )

        with open(cert_file, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        with open(key_file, "wb") as f:
            f.write(key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.TraditionalOpenSSL,
                serialization.NoEncryption(),
            ))

        print("  📜 SSL 证书已生成 (Python cryptography)")
        return cert_file, key_file

    except ImportError:
        pass
    except Exception as e:
        print(f"  ⚠️  Python cryptography 生成证书失败: {e}")

    # Method 2: Try openssl CLI
    is_win = platform.system() == "Windows"
    devnull = "NUL" if is_win else "/dev/null"

    ret = os.system(
        f'openssl req -x509 -newkey rsa:2048 -keyout "{key_file}" -out "{cert_file}" '
        f'-days 365 -nodes -subj "/CN=localhost/O=Lingxi" 2>{devnull}'
    )

    if ret == 0:
        print("  📜 SSL 证书已生成 (OpenSSL CLI)")
        return cert_file, key_file

    return None, None


def main():
    """Main entry point for the Lingxi backend server."""

    print("\n" + "=" * 60)
    print("  🔮 灵析 Lingxi - 领域通用智能体框架")
    print("  Domain-General Agent Framework v1.0.0")
    print("=" * 60)
    print()

    host = "0.0.0.0"
    port = 8000

    print(f"  🌐 访问地址: http://localhost:{port}")
    print(f"  📡 API 文档: http://localhost:{port}/docs")
    print()
    print("  按 Ctrl+C 停止服务器")
    print("=" * 60)
    print()

    uvicorn.run(
        "api:app",
        host=host,
        port=port,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()