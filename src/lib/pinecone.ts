import { Pinecone } from "@pinecone-database/pinecone"

export const getPineconeIndex = () => {
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
  });
  return pc.index('cognitext');
}
