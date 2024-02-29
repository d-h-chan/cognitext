import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { PDFLoader } from "langchain/document_loaders/fs/pdf"
import { OpenAIEmbeddings } from "@langchain/openai"
import { getPineconeIndex } from '@/lib/pinecone'
import { PineconeStore } from "@langchain/pinecone";

const f = createUploadthing();

// Uploadthing FileRouter, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  pdfUploader: f({ pdf: { maxFileSize: "4MB" } })
    // This code runs on the server BEFORE upload
    .middleware(async ({ req }) => {
      const { getUser } = getKindeServerSession();
      const user = await getUser();

      if (!user || !user.id) throw new Error("Unauthroized");

      return { userId: user.id };
    })
    // This code runs on the server AFTER upload
    .onUploadComplete(async ({ metadata, file }) => {
      // Once file upload to uploadthing is complete, create an row in prisma db for the file
      const createdFile = await db.file.create({
        data: {
          key: file.key,
          name: file.name,
          userId: metadata.userId,
          url: file.url, // if timing out problem occurs, switch to hardcoded uploadthing file url
          uploadStatus: "PROCESSING",
        },
      });

      try {
        // todo: comment this better
        const response = await fetch(file.url)
        const blob = await response.blob()
        const loader = new PDFLoader(blob)
        const pageLevelDocs = await loader.load()

        // for paid plan
        const pagesAmt = pageLevelDocs.length

        // vectorize/index entire pdf document in pinecone
        const pineconeIndex = await getPineconeIndex()
        const embeddings = new OpenAIEmbeddings({
          openAIApiKey: process.env.OPENAI_API_KEY
        })

        await PineconeStore.fromDocuments(pageLevelDocs, embeddings, {
          pineconeIndex,
          namespace: createdFile.id
        });

        // change status to SUCCESS in db after indexing is complete
        await db.file.update({
          data: {
            uploadStatus: 'SUCCESS',
          },
          where: {
            id: createdFile.id,
          },
        })
      } catch (err) {
        console.log(err)
        await db.file.update({
          data: {
            uploadStatus: 'FAILED',
          },
          where: {
            id: createdFile.id,
          },
        })
      }

      // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
