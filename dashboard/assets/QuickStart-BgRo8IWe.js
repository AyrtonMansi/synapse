import{j as e}from"./vendor-wagmi-vFUbRHPB.js";import{r as n,L as r}from"./vendor-react-Dw6xBsqb.js";import{C as t}from"./chevron-right-DOZdDRCj.js";import{T as i}from"./index-DKXM9sTJ.js";import{A as p}from"./arrow-right-DJDHDJSV.js";import{C as u}from"./check-CYAc-h0H.js";import{C as b}from"./copy-CgSLxoRJ.js";import{C as f}from"./code-CZQVbs8V.js";import{E as j}from"./external-link-C4XP0NnV.js";const c=[{number:"01",title:"Create an Account",description:"Connect your wallet to the Synapse Dashboard to get started.",action:"Go to Dashboard",href:"/dashboard"},{number:"02",title:"Generate an API Key",description:"Create an API key from the dashboard. Your first 1 million tokens are free.",action:"Generate Key",href:"/dashboard"},{number:"03",title:"Make Your First Request",description:"Use our OpenAI-compatible API to start making inference requests.",action:"View API Docs",href:"/docs/api"}],m={curl:`curl https://api.synapse.network/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer syn_your_api_key" \\
  -d '{
    "model": "llama-3-70b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,python:`import openai

# Initialize with Synapse
client = openai.OpenAI(
    base_url="https://api.synapse.network/v1",
    api_key="syn_your_api_key"
)

# Make a request
response = client.chat.completions.create(
    model="llama-3-70b",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`,javascript:`import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.synapse.network/v1',
  apiKey: 'syn_your_api_key',
});

async function main() {
  const completion = await client.chat.completions.create({
    model: 'llama-3-70b',
    messages: [{ role: 'user', content: 'Hello!' }],
  });

  console.log(completion.choices[0].message.content);
}

main();`};function I(){const[a,d]=n.useState("curl"),[l,o]=n.useState(!1),x=s=>{navigator.clipboard.writeText(s),o(!0),setTimeout(()=>o(!1),2e3)};return e.jsxs("div",{className:"max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8",children:[e.jsxs("div",{className:"flex items-center gap-2 text-sm text-neutral-400 mb-8",children:[e.jsx("a",{href:"/docs",className:"hover:text-emerald-400 transition-colors",children:"Docs"}),e.jsx(t,{className:"w-4 h-4"}),e.jsx("span",{className:"text-white",children:"Quick Start"})]}),e.jsxs("div",{className:"mb-12",children:[e.jsxs("div",{className:"inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-6",children:[e.jsx(i,{className:"w-4 h-4"}),"Quick Start"]}),e.jsx("h1",{className:"text-4xl font-bold mb-4",children:"Get Started in 5 Minutes"}),e.jsx("p",{className:"text-neutral-400 text-lg",children:"Learn how to make your first API call to the Synapse network. Our API is compatible with OpenAI, so you can use your existing code with minimal changes."})]}),e.jsx("div",{className:"space-y-8 mb-12",children:c.map((s,h)=>e.jsxs("div",{className:"flex gap-6",children:[e.jsxs("div",{className:"flex flex-col items-center",children:[e.jsx("div",{className:"w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center",children:e.jsx("span",{className:"text-emerald-400 font-bold",children:s.number})}),h<c.length-1&&e.jsx("div",{className:"w-px h-full bg-white/[0.08] mt-4"})]}),e.jsxs("div",{className:"flex-1 pb-8",children:[e.jsx("h2",{className:"text-xl font-semibold mb-2",children:s.title}),e.jsx("p",{className:"text-neutral-400 mb-4",children:s.description}),e.jsxs(r,{to:s.href,className:"inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors",children:[s.action,e.jsx(p,{className:"w-4 h-4"})]})]})]},s.number))}),e.jsxs("div",{className:"mb-12",children:[e.jsx("h2",{className:"text-2xl font-semibold mb-6",children:"Make Your First Request"}),e.jsx("div",{className:"flex gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl mb-4 w-fit",children:[{id:"curl",label:"cURL"},{id:"python",label:"Python"},{id:"javascript",label:"JavaScript"}].map(s=>e.jsx("button",{onClick:()=>d(s.id),className:`px-4 py-2 rounded-lg text-sm font-medium transition-all ${a===s.id?"bg-emerald-500 text-black":"text-neutral-400 hover:text-white hover:bg-white/[0.05]"}`,children:s.label},s.id))}),e.jsxs("div",{className:"bg-[#0a0a0a] border border-white/[0.08] rounded-xl overflow-hidden",children:[e.jsxs("div",{className:"flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/[0.08]",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"w-3 h-3 rounded-full bg-red-500/80"}),e.jsx("div",{className:"w-3 h-3 rounded-full bg-yellow-500/80"}),e.jsx("div",{className:"w-3 h-3 rounded-full bg-green-500/80"})]}),e.jsxs("button",{onClick:()=>x(m[a]),className:"text-xs text-neutral-500 hover:text-emerald-400 transition-colors flex items-center gap-1",children:[l?e.jsx(u,{className:"w-3 h-3"}):e.jsx(b,{className:"w-3 h-3"}),l?"Copied!":"Copy"]})]}),e.jsx("div",{className:"p-4 overflow-x-auto",children:e.jsx("pre",{className:"text-sm font-mono",children:e.jsx("code",{className:"text-neutral-300",children:m[a]})})})]})]}),e.jsxs("div",{className:"mb-12",children:[e.jsx("h2",{className:"text-2xl font-semibold mb-4",children:"Expected Response"}),e.jsx("div",{className:"bg-[#0a0a0a] border border-white/[0.08] rounded-xl p-4 overflow-x-auto",children:e.jsx("pre",{className:"text-sm font-mono",children:e.jsx("code",{className:"text-neutral-300",children:`{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "llama-3-70b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 4,
    "completion_tokens": 10,
    "total_tokens": 14
  }
}`})})})]}),e.jsxs("div",{className:"bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl p-6",children:[e.jsx("h2",{className:"text-xl font-semibold mb-4",children:"Next Steps"}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs(r,{to:"/docs/api",className:"flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.05] transition-colors group",children:[e.jsx(f,{className:"w-5 h-5 text-emerald-400"}),e.jsxs("div",{className:"flex-1",children:[e.jsx("p",{className:"font-medium group-hover:text-emerald-400 transition-colors",children:"Explore the API Reference"}),e.jsx("p",{className:"text-sm text-neutral-500",children:"Learn about all available endpoints and parameters"})]}),e.jsx(t,{className:"w-5 h-5 text-neutral-600 group-hover:text-emerald-400 transition-colors"})]}),e.jsxs(r,{to:"/docs/sdk",className:"flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.05] transition-colors group",children:[e.jsx(i,{className:"w-5 h-5 text-emerald-400"}),e.jsxs("div",{className:"flex-1",children:[e.jsx("p",{className:"font-medium group-hover:text-emerald-400 transition-colors",children:"Install the SDK"}),e.jsx("p",{className:"text-sm text-neutral-500",children:"Use our official SDKs for easier integration"})]}),e.jsx(t,{className:"w-5 h-5 text-neutral-600 group-hover:text-emerald-400 transition-colors"})]}),e.jsxs("a",{href:"https://discord.gg/synapse",target:"_blank",rel:"noopener noreferrer",className:"flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.05] transition-colors group",children:[e.jsx(j,{className:"w-5 h-5 text-emerald-400"}),e.jsxs("div",{className:"flex-1",children:[e.jsx("p",{className:"font-medium group-hover:text-emerald-400 transition-colors",children:"Join our Community"}),e.jsx("p",{className:"text-sm text-neutral-500",children:"Get help from the team and other developers"})]}),e.jsx(t,{className:"w-5 h-5 text-neutral-600 group-hover:text-emerald-400 transition-colors"})]})]})]})]})}export{I as default};
