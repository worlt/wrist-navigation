import java.nio.file.*;
import java.security.*;
import java.security.cert.CertificateFactory;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

/**
 * Rebuild signing/development.p12 from the existing Vela PEM identity.
 * The paired band and phone must share one certificate, so this imports the
 * key that already signed the RPK instead of minting a second identity.
 */
public class ImportSigning {
    public static void main(String[] args) throws Exception {
        Path root = Path.of(args[0]).toAbsolutePath();
        Path pemDirectory = root.resolve("wearable/sign/debug");
        Path certificatePath = pemDirectory.resolve("certificate.pem");
        Path privateKeyPath = pemDirectory.resolve("private.pem");
        if (!Files.isRegularFile(certificatePath) || !Files.isRegularFile(privateKeyPath)) {
            throw new IllegalStateException("Missing wearable/sign/debug/{certificate,private}.pem; nothing to import.");
        }
        PrivateKey key = KeyFactory.getInstance("RSA")
            .generatePrivate(new PKCS8EncodedKeySpec(der(privateKeyPath, "PRIVATE KEY")));
        CertificateFactory factory = CertificateFactory.getInstance("X.509");
        java.security.cert.Certificate certificate;
        try (var input = Files.newInputStream(certificatePath)) {
            certificate = factory.generateCertificate(input);
        }
        byte[] challenge = "wrist-navigation".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        Signature signer = Signature.getInstance("SHA256withRSA");
        signer.initSign(key);
        signer.update(challenge);
        byte[] signature = signer.sign();
        Signature verifier = Signature.getInstance("SHA256withRSA");
        verifier.initVerify(certificate.getPublicKey());
        verifier.update(challenge);
        if (!verifier.verify(signature)) {
            throw new IllegalStateException("wearable/sign/debug private key does not match certificate.pem.");
        }
        KeyStore store = KeyStore.getInstance("PKCS12");
        store.load(null, null);
        store.setKeyEntry("wrist-navigation", key, "android".toCharArray(), new java.security.cert.Certificate[] { certificate });
        Path output = root.resolve("signing/development.p12");
        Files.createDirectories(output.getParent());
        try (var stream = Files.newOutputStream(output)) {
            store.store(stream, "android".toCharArray());
        }
        System.out.println("Imported the wearable identity into signing/development.p12.");
    }

    private static byte[] der(Path path, String type) throws Exception {
        String text = Files.readString(path);
        int start = text.indexOf("-----BEGIN " + type + "-----");
        int end = text.indexOf("-----END " + type + "-----");
        if (start < 0 || end < 0) throw new IllegalStateException("Malformed PEM: " + path);
        String body = text.substring(start + ("-----BEGIN " + type + "-----").length(), end);
        return Base64.getMimeDecoder().decode(body);
    }
}
