import java.nio.file.*;
import java.security.*;
import java.util.Base64;
import java.util.Properties;

/** Export our local development identity to the Vela PEM format, entirely offline. */
public class ExportSigning {
    public static void main(String[] args) throws Exception {
        Path root = Path.of(args[0]).toAbsolutePath();
        Properties passwords = new Properties();
        Path passwordsFile = root.resolve("signing/passwords.properties");
        if (Files.isRegularFile(passwordsFile)) {
            try (var input = Files.newInputStream(passwordsFile)) { passwords.load(input); }
        }
        String configured = System.getenv("WRIST_SIGNING_PASSWORD");
        if (configured == null || configured.isEmpty()) configured = passwords.getProperty("password");
        if (configured == null || configured.isEmpty()) throw new IllegalStateException("Restore local signing/passwords.properties or set WRIST_SIGNING_PASSWORD.");
        char[] password = configured.toCharArray();
        KeyStore store = KeyStore.getInstance("PKCS12");
        try (var input = Files.newInputStream(root.resolve("signing/development.p12"))) {
            store.load(input, password);
        }
        Path destination = root.resolve("wearable/sign/debug");
        Files.createDirectories(destination);
        write(destination.resolve("private.pem"), "PRIVATE KEY", store.getKey("wrist-navigation", password).getEncoded());
        write(destination.resolve("certificate.pem"), "CERTIFICATE", store.getCertificate("wrist-navigation").getEncoded());
        System.out.println("Android and Vela development signing identity prepared.");
    }
    private static void write(Path path, String type, byte[] data) throws Exception {
        Files.writeString(path, "-----BEGIN " + type + "-----\n" + Base64.getMimeEncoder(64, new byte[]{10}).encodeToString(data) + "\n-----END " + type + "-----\n");
    }
}

