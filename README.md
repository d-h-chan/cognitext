<div>

## <a name="introduction">🤖 Introduction</a>

An AI-driven SaaS that allows users to upload PDF documents and converse with them via text chat. Supports authentication and different price tiers. [Check it out here!](https://imaginify-dchan.vercel.app/)


## <a name="tech-stack">⚙️ Tech Stack</a>

- Next.js
- TypeScript
- Prisma
- Langchain
- Pinecone
- Kinde
- Uploadthing
- Stripe
- Shadcn
- TailwindCSS

## <a name="features">🔋 Features</a>

🛠️ Complete SaaS Built From Scratch

💻 Beautiful Landing Page & Pricing Page Included

💳 Free & Pro Plan Using Stripe

📄 A Beautiful And Highly Functional PDF Viewer

🔄 Streaming API Responses in Real-Time

🔒 Authentication Using Kinde

🎨 Clean, Modern UI Using 'shadcn-ui'

🚀 Optimistic UI Updates for a Great UX

⚡ Infinite Message Loading for Performance

📤 Intuitive Drag n’ Drop Uploads

✨ Instant Loading States

🔧 Modern Data Fetching Using tRPC & Zod

🧠 LangChain for Infinite AI Memory

🌲 Pinecone as our Vector Storage

📊 Prisma as our ORM

🔤 100% written in TypeScript

## <a name="quick-start">🤸 Quick Start</a>

Follow these steps to set up the project locally on your machine.

**Prerequisites**

Make sure you have the following installed on your machine:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/en)
- [npm](https://www.npmjs.com/) (Node Package Manager)

**Cloning the Repository**

```bash
git clone https://github.com/d-h-chan/cognitext.git
cd cognitext
```

**Installation**

Install the project dependencies using npm:

```bash
npm run dev
```

**Set Up Environment Variables**

Create a new file named `.env.local` in the root of your project and add the following content:

```env
KINDE_CLIENT_ID=
KINDE_CLIENT_SECRET=
KINDE_ISSUER_URL=
KINDE_SITE_URL=
KINDE_POST_LOGOUT_REDIRECT_URL=
KINDE_POST_LOGIN_REDIRECT_URL=

DATABASE_URL=

UPLOADTHING_SECRET=
UPLOADTHING_APP_ID=

OPENAI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

PINECONE_API_KEY=

HARDCODED_VERCEL_URL=
```

Replace the placeholder values with your actual respective account credentials

**Running the Project**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the project.
</div>
