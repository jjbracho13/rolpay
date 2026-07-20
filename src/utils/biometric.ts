import { NativeBiometric } from '@capgo/capacitor-native-biometric';

const SERVER = 'rolpay.app';

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function verifyBiometric(): Promise<boolean> {
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Inicia sesión con tu huella o rostro',
    });
    return true;
  } catch {
    return false;
  }
}

export async function saveCredentials(email: string, password: string): Promise<void> {
  await NativeBiometric.setCredentials({
    username: email,
    password,
    server: SERVER,
  });
}

export async function getCredentials(): Promise<{ username: string; password: string } | null> {
  try {
    const creds = await NativeBiometric.getCredentials({ server: SERVER });
    return { username: creds.username, password: creds.password };
  } catch {
    return null;
  }
}

export async function deleteCredentials(): Promise<void> {
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER });
  } catch {}
}
