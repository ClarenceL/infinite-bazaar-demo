// Mock implementation of IdentityService to avoid loading PolygonID SDK during tests

export class IdentityService {
  async createIdentity() {
    return {
      did: "did:polygonid:polygon:mumbai:2qDyy1kEo2AYcP3RT4XGea7BtxsY285szg6yP9SPrs",
      privateKey: "mock-private-key",
      address: "0x1234567890123456789012345678901234567890",
    };
  }

  async signData(data: any) {
    return "mock-signature";
  }

  async verifySignature(signature: string, data: any) {
    return true;
  }
}

export type IdentityCreationResult = {
  did: string;
  privateKey: string;
  address: string;
};
