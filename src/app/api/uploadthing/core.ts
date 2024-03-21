import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { OpenAIEmbeddings } from "@langchain/openai";
import { getPineconeIndex } from "@/lib/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { getUserSubscriptionPlan } from "@/lib/stripe";
import { PLANS } from "@/config/stripe";

const f = createUploadthing();

const middleware = async () => {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (!user || !user.id) throw new Error("Unauthroized");

  const subscriptionPlan = await getUserSubscriptionPlan();

  return { subscriptionPlan, userId: user.id };
};

const onUploadComplete = async ({
  metadata,
  file,
}: {
  metadata: Awaited<ReturnType<typeof middleware>>;
  file: {
    key: string;
    name: string;
    url: string;
  };
}) => {
  // if something hiccups and tries to make two files
  const isFileExist = await db.file.findFirst({
    where: {
      key: file.key,
    },
  });
  if (isFileExist) return;

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
    // get PDF text from file
    const response = await fetch(file.url);
    const blob = await response.blob();
    const loader = new PDFLoader(blob);
    const pageLevelDocs = await loader.load();

    // vectorize/index entire pdf document in pinecone
    const pineconeIndex = await getPineconeIndex();
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    await PineconeStore.fromDocuments(pageLevelDocs, embeddings, {
      pineconeIndex,
      namespace: createdFile.id,
    });

    // check for pro plan
    const pagesAmt = pageLevelDocs.length;
    const { subscriptionPlan } = metadata; // added in .middleware above
    const { isSubscribed } = subscriptionPlan;

    const isProExceeded =
      pagesAmt > PLANS.find((plan) => plan.name === "Pro")!.pagesPerPdf;
    const isFreeExceeded =
      pagesAmt > PLANS.find((plan) => plan.name === "Free")!.pagesPerPdf;

    if ((isSubscribed && isProExceeded) || (!isSubscribed && isFreeExceeded)) {
      await db.file.update({
        data: {
          uploadStatus: "FAILED",
        },
        where: {
          id: createdFile.id,
        },
      });
    } else {
      await db.file.update({
        data: {
          uploadStatus: "SUCCESS",
        },
        where: {
          id: createdFile.id,
        },
      });
    }
  } catch (err) {
    await db.file.update({
      data: {
        uploadStatus: "FAILED",
      },
      where: {
        id: createdFile.id,
      },
    });
  }

  // Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
  return { uploadedBy: metadata.userId };
};

// Uploadthing FileRouter, can contain multiple FileRoutes
export const ourFileRouter = {
  freePlanUploader: f({ pdf: { maxFileSize: "4MB" } })
    // This code runs on the server BEFORE upload
    .middleware(middleware)
    // This code runs on the server AFTER upload
    .onUploadComplete(onUploadComplete),
  proPlanUploader: f({ pdf: { maxFileSize: "16MB" } })
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
