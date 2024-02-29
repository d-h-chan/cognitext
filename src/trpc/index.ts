import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { privateProcedure, publicProcedure, router } from "./trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { z } from "zod";
import { UTApi } from "uploadthing/server";
import { INFINITE_QUERY_LIMIT } from "@/config/infinite-query";
import { getPineconeIndex } from "@/lib/pinecone";
import { absoluteUrl } from "@/lib/utils";
import { getUserSubscriptionPlan, stripe } from "@/lib/stripe";
import { PLANS } from "@/config/stripe";

const utapi = new UTApi();

// This is where server api endpoints go
export const appRouter = router({
  // Authenticate user, add them to db
  authCallback: publicProcedure.query(async () => {
    // Check for logged in user
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    if (!user?.id || !user?.email) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    // Create row for user in db if they don't already have one
    const dbUser = await db.user.findFirst({
      where: {
        id: user.id,
      },
    });
    if (!dbUser) {
      await db.user.create({
        data: {
          id: user.id,
          email: user.email,
        },
      });
    }

    return { success: true };
  }),
  // Get all of a user's files from db
  getUserFiles: privateProcedure.query(async ({ ctx }) => {
    // ctx (context) is populated from trpc.ts privateProcedure middleware
    const { userId } = ctx;
    return await db.file.findMany({
      where: {
        userId,
      },
    });
  }),
  createStripeSession: privateProcedure.mutation(async ({ ctx }) => {
    const { userId } = ctx;

    const billingUrl = absoluteUrl("/dashboard/billing");

    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const dbUser = await db.user.findFirst({
      where: {
        id: userId,
      },
    });

    if (!dbUser) throw new TRPCError({ code: "UNAUTHORIZED" });

    const subscriptionPlan = await getUserSubscriptionPlan();

    if (subscriptionPlan.isSubscribed && dbUser.stripeCustomerId) {
      const stripeSession = await stripe.billingPortal.sessions.create({
        customer: dbUser.stripeCustomerId,
        return_url: billingUrl
      })

      return { url: stripeSession.url }
    }

    const stripeSession = await stripe.checkout.sessions.create({
      success_url: billingUrl,
      cancel_url: billingUrl,
      payment_method_types: ["card", "paypal"],
      mode: "subscription",
      billing_address_collection: "auto",
      line_items: [
        {
          price: PLANS.find((plan) => plan.name === "Pro")?.price.priceIds.test,
          quantity: 1
        }
      ],
      metadata: {
        userId: userId
      }
    })

    return { url: stripeSession.url }
  }),
  // get all messages asked to a PDF
  getFileMessages: privateProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).nullish(),
        cursor: z.string().nullish(),
        fileId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { fileId, cursor } = input;
      const limit = input.limit ?? INFINITE_QUERY_LIMIT;

      const file = await db.file.findFirst({
        where: {
          id: fileId,
          userId,
        },
      });

      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      const messages = await db.message.findMany({
        take: limit + 1,
        where: {
          fileId,
        },
        orderBy: {
          createdAt: "desc",
        },
        cursor: cursor ? { id: cursor } : undefined,
        select: {
          id: true,
          isUserMessage: true,
          createdAt: true,
          text: true,
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (messages.length > limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem?.id;
      }

      return {
        messages,
        nextCursor,
      };
    }),
  //todo comment
  getFileMessageCounts: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;
    const messages = await db.message.findMany({
      where: {
        userId,
        isUserMessage: true,
      },
    });

    const fileMessageCounts: any = {};
    messages.forEach((message) => {
      if (!fileMessageCounts.hasOwnProperty(message?.fileId!)) {
        fileMessageCounts[message?.fileId!] = 1;
      } else {
        fileMessageCounts[message?.fileId!]++;
      }
    });

    return fileMessageCounts;
  }),
  // Find a file and check for the status of its upload
  getFileUploadStatus: privateProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const file = await db.file.findFirst({
        where: {
          id: input.fileId,
          userId: ctx.userId,
        },
      });

      if (!file) return { status: "PENDING" as const };

      return { status: file.uploadStatus };
    }),
  // Get a user's specific file from db
  getFile: privateProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      const file = await db.file.findFirst({
        where: {
          key: input.key,
          userId,
        },
      });
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      return file;
    }),
  // Delete a users file and messages from db, UploadThing, and pinecone
  deleteFile: privateProcedure
    .input(z.object({ id: z.string(), key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      const file = await db.file.findFirst({
        where: {
          id: input.id,
          userId,
        },
      });
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      // delete rows from prisma message table
      await db.message.deleteMany({
        where: {
          fileId: file.id,
        },
      });

      // delete rows from prisma file table
      await db.file.delete({
        where: {
          id: input.id,
        },
      });

      // delete file from UT bucket
      await utapi.deleteFiles(input.key);

      // delete vectors from pinecone
      const pineconeIndex = await getPineconeIndex();
      await pineconeIndex.namespace(input.id).deleteAll();

      return file;
    }),
});

// Export type router type signature, NOT the router itself.
export type AppRouter = typeof appRouter;
