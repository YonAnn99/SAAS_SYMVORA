/**
 * Tipos de datos para Google Wallet API (Loyalty Cards).
 * Basado en la especificación oficial de Google Pay API for Passes / Google Wallet.
 */

export interface GoogleWalletConfig {
  issuerId: string;
  clientEmail: string;
  privateKey: string;
}

export type BarcodeType = "QR_CODE" | "CODE_128" | "UPC_A" | "AZTEC";

export interface GoogleWalletBarcode {
  type: BarcodeType;
  value: string;
  alternateText?: string;
}

export interface GoogleWalletUri {
  uri: string;
  description?: string;
}

export interface GoogleWalletImage {
  sourceUri: GoogleWalletUri;
  contentDescription?: {
    defaultValue: {
      language: string;
      value: string;
    };
  };
}

export interface GoogleWalletTextModule {
  id?: string;
  header: string;
  body: string;
}

export interface GoogleWalletLoyaltyPoints {
  label: string;
  balance: {
    string?: string;
    int?: number;
    double?: number;
  };
}

export interface GoogleWalletLoyaltyClass {
  id: string; // formato: `${issuerId}.${classId}`
  issuerName: string;
  programName: string;
  programLogo?: GoogleWalletImage;
  hexBackgroundColor?: string;
  reviewStatus: "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "DRAFT";
  allowMultipleUsersPerObject?: boolean;
}

export interface GoogleWalletLoyaltyObject {
  id: string; // formato: `${issuerId}.${objectId}`
  classId: string;
  state: "ACTIVE" | "COMPLETED" | "EXPIRED" | "INACTIVE";
  accountId: string;
  accountName: string;
  barcode: GoogleWalletBarcode;
  loyaltyPoints: GoogleWalletLoyaltyPoints;
  secondaryLoyaltyPoints?: GoogleWalletLoyaltyPoints;
  textModulesData?: GoogleWalletTextModule[];
  linksModuleData?: {
    uris: GoogleWalletUri[];
  };
}

export interface GoogleWalletJwtPayload {
  iss: string; // Service Account Email
  aud: string; // "google"
  typ: string; // "savetowallet"
  iat: number;
  origins?: string[];
  payload: {
    loyaltyClasses?: GoogleWalletLoyaltyClass[];
    loyaltyObjects: GoogleWalletLoyaltyObject[];
  };
}
