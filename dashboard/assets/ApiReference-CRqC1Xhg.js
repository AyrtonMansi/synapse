import{j as e}from"./vendor-wagmi-BHP7yosM.js";import{r as n}from"./vendor-react-Dw6xBsqb.js";import{C as o}from"./chevron-right-DzeVEh_X.js";import{T as c,C as x,A as p,m as h}from"./index-D65TvpS1.js";import{C as u}from"./code-BqxgvI8X.js";import{F as b}from"./file-text-CYj2sY5o.js";import{A as j}from"./alert-circle-LzTLSxsX.js";import{C as g}from"./check-Cn5D5HTc.js";import{C as f}from"./copy-00FV7Ki8.js";const N=[{method:"POST",path:"/v1/chat/completions",name:"Chat Completions",description:"Generate text responses from AI models. Compatible with OpenAI's chat completions API.",requestExample:`curl https://api.synapse.network/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer syn_your_api_key" \\
  -d '{
    "model": "llama-3-70b",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7,
    "max_tokens": 150
  }'`,responseExample:`{
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
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}`,parameters:[{name:"model",type:"string",required:!0,description:"ID of the model to use (e.g., llama-3-70b, gpt-4, claude-3-opus)"},{name:"messages",type:"array",required:!0,description:"Array of message objects with role and content"},{name:"temperature",type:"number",required:!1,description:"Sampling temperature (0-2). Default: 1"},{name:"max_tokens",type:"integer",required:!1,description:"Maximum tokens to generate"},{name:"stream",type:"boolean",required:!1,description:"Stream responses as Server-Sent Events"}]},{method:"POST",path:"/v1/embeddings",name:"Create Embeddings",description:"Generate vector embeddings for text input.",requestExample:`curl https://api.synapse.network/v1/embeddings \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer syn_your_api_key" \\
  -d '{
    "model": "text-embedding-3-large",
    "input": "The food was delicious and the waiter..."
  }'`,responseExample:`{
  "object": "list",
  "data": [{
    "object": "embedding",
    "embedding": [0.0023064255, -0.009327292, ...],
    "index": 0
  }],
  "model": "text-embedding-3-large",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}`,parameters:[{name:"model",type:"string",required:!0,description:"ID of the embedding model"},{name:"input",type:"string/array",required:!0,description:"Text to embed. Can be a string or array of strings."},{name:"dimensions",type:"integer",required:!1,description:"Number of dimensions for the output"}]},{method:"GET",path:"/v1/models",name:"List Models",description:"List all available models on the Synapse network.",requestExample:`curl https://api.synapse.network/v1/models \\
  -H "Authorization: Bearer syn_your_api_key"`,responseExample:`{
  "object": "list",
  "data": [
    {
      "id": "llama-3-70b",
      "object": "model",
      "created": 1677610602,
      "owned_by": "synapse"
    },
    {
      "id": "gpt-4",
      "object": "model",
      "created": 1687882411,
      "owned_by": "synapse"
    }
  ]
}`,parameters:[]}],v=[{id:"llama-3-70b",provider:"Meta",context:"8192",pricing:"$0.0015/1K tokens",capabilities:["chat","code","analysis"]},{id:"gpt-4",provider:"OpenAI",context:"8192",pricing:"$0.015/1K tokens",capabilities:["chat","code","vision"]},{id:"claude-3-opus",provider:"Anthropic",context:"200000",pricing:"$0.015/1K tokens",capabilities:["chat","analysis","long-context"]},{id:"mistral-large",provider:"Mistral",context:"32000",pricing:"$0.003/1K tokens",capabilities:["chat","code","analysis"]},{id:"text-embedding-3-large",provider:"OpenAI",context:"8191",pricing:"$0.0001/1K tokens",capabilities:["embeddings"]}],y=[{code:"400",name:"Bad Request",description:"Invalid request body or parameters"},{code:"401",name:"Unauthorized",description:"Invalid or missing API key"},{code:"429",name:"Rate Limited",description:"Too many requests. Upgrade your plan or wait."},{code:"500",name:"Internal Server Error",description:"Server error. Please try again later."},{code:"503",name:"Service Unavailable",description:"The service is temporarily unavailable"}];function w({endpoint:s}){const[r,t]=n.useState(!1),[i,l]=n.useState(!1),d=a=>{navigator.clipboard.writeText(a),l(!0),setTimeout(()=>l(!1),2e3)},m=a=>{switch(a){case"GET":return"text-blue-400 bg-blue-500/10";case"POST":return"text-emerald-400 bg-emerald-500/10";case"PUT":return"text-amber-400 bg-amber-500/10";case"DELETE":return"text-red-400 bg-red-500/10";default:return"text-neutral-400 bg-neutral-500/10"}};return e.jsxs("div",{className:"bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden",children:[e.jsxs("button",{onClick:()=>t(!r),className:"w-full p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors",children:[e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx("span",{className:`px-2 py-1 rounded text-xs font-mono font-medium ${m(s.method)}`,children:s.method}),e.jsxs("div",{className:"text-left",children:[e.jsx("p",{className:"font-mono text-sm",children:s.path}),e.jsx("p",{className:"text-sm text-neutral-500",children:s.name})]})]}),r?e.jsx(x,{className:"w-5 h-5 text-neutral-500"}):e.jsx(o,{className:"w-5 h-5 text-neutral-500"})]}),e.jsx(p,{children:r&&e.jsx(h.div,{initial:{height:0},animate:{height:"auto"},exit:{height:0},className:"overflow-hidden",children:e.jsxs("div",{className:"p-6 border-t border-white/[0.06]",children:[e.jsx("p",{className:"text-neutral-400 mb-6",children:s.description}),s.parameters.length>0&&e.jsxs("div",{className:"mb-6",children:[e.jsx("h4",{className:"text-sm font-medium mb-3",children:"Parameters"}),e.jsx("div",{className:"space-y-2",children:s.parameters.map(a=>e.jsx("div",{className:"flex items-start gap-3 p-3 bg-white/[0.03] rounded-lg",children:e.jsxs("div",{className:"flex-1",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("code",{className:"text-sm text-emerald-400",children:a.name}),e.jsx("span",{className:"text-xs text-neutral-500",children:a.type}),a.required&&e.jsx("span",{className:"text-xs text-red-400",children:"required"})]}),e.jsx("p",{className:"text-sm text-neutral-500 mt-1",children:a.description})]})},a.name))})]}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("h4",{className:"text-sm font-medium",children:"Request Example"}),e.jsxs("button",{onClick:()=>d(s.requestExample),className:"text-xs text-neutral-500 hover:text-emerald-400 transition-colors flex items-center gap-1",children:[i?e.jsx(g,{className:"w-3 h-3"}):e.jsx(f,{className:"w-3 h-3"}),i?"Copied!":"Copy"]})]}),e.jsx("pre",{className:"bg-[#0a0a0a] border border-white/[0.06] rounded-lg p-4 overflow-x-auto",children:e.jsx("code",{className:"text-sm font-mono text-neutral-300",children:s.requestExample})})]}),e.jsxs("div",{children:[e.jsx("h4",{className:"text-sm font-medium mb-2",children:"Response Example"}),e.jsx("pre",{className:"bg-[#0a0a0a] border border-white/[0.06] rounded-lg p-4 overflow-x-auto",children:e.jsx("code",{className:"text-sm font-mono text-neutral-300",children:s.responseExample})})]})]})]})})})]})}function P(){const[s,r]=n.useState("endpoints");return e.jsxs("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8",children:[e.jsxs("div",{className:"mb-8",children:[e.jsxs("div",{className:"flex items-center gap-2 text-sm text-neutral-400 mb-4",children:[e.jsx("a",{href:"/docs",className:"hover:text-emerald-400 transition-colors",children:"Docs"}),e.jsx(o,{className:"w-4 h-4"}),e.jsx("span",{className:"text-white",children:"API Reference"})]}),e.jsx("h1",{className:"text-4xl font-bold mb-4",children:"API Reference"}),e.jsx("p",{className:"text-neutral-400 max-w-2xl",children:"The Synapse API is organized around REST. Our API is compatible with OpenAI's API, making it easy to migrate your existing applications."})]}),e.jsx("div",{className:"bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-8",children:e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(c,{className:"w-5 h-5 text-emerald-400"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm text-neutral-400",children:"Base URL"}),e.jsx("code",{className:"text-emerald-400 font-mono",children:"https://api.synapse.network/v1"})]})]})}),e.jsx("div",{className:"flex gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl mb-8 w-fit",children:[{id:"endpoints",label:"Endpoints"},{id:"models",label:"Models"},{id:"errors",label:"Errors"}].map(t=>e.jsx("button",{onClick:()=>r(t.id),className:`px-4 py-2 rounded-lg text-sm font-medium transition-all ${s===t.id?"bg-emerald-500 text-black":"text-neutral-400 hover:text-white hover:bg-white/[0.05]"}`,children:t.label},t.id))}),s==="endpoints"&&e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-6",children:[e.jsx(u,{className:"w-5 h-5 text-emerald-400"}),e.jsx("h2",{className:"text-xl font-semibold",children:"Endpoints"})]}),N.map(t=>e.jsx(w,{endpoint:t},t.path))]}),s==="models"&&e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-6",children:[e.jsx(b,{className:"w-5 h-5 text-emerald-400"}),e.jsx("h2",{className:"text-xl font-semibold",children:"Available Models"})]}),e.jsx("div",{className:"bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden",children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{className:"bg-white/[0.03]",children:e.jsxs("tr",{children:[e.jsx("th",{className:"text-left px-6 py-4 text-sm font-medium text-neutral-400",children:"Model"}),e.jsx("th",{className:"text-left px-6 py-4 text-sm font-medium text-neutral-400",children:"Provider"}),e.jsx("th",{className:"text-left px-6 py-4 text-sm font-medium text-neutral-400",children:"Context"}),e.jsx("th",{className:"text-left px-6 py-4 text-sm font-medium text-neutral-400",children:"Pricing"})]})}),e.jsx("tbody",{className:"divide-y divide-white/[0.06]",children:v.map(t=>e.jsxs("tr",{className:"hover:bg-white/[0.03]",children:[e.jsxs("td",{className:"px-6 py-4",children:[e.jsx("code",{className:"text-emerald-400 font-mono text-sm",children:t.id}),e.jsx("div",{className:"flex gap-2 mt-1",children:t.capabilities.map(i=>e.jsx("span",{className:"text-xs px-2 py-0.5 bg-white/[0.05] rounded text-neutral-500",children:i},i))})]}),e.jsx("td",{className:"px-6 py-4 text-sm",children:t.provider}),e.jsxs("td",{className:"px-6 py-4 text-sm",children:[parseInt(t.context).toLocaleString()," tokens"]}),e.jsx("td",{className:"px-6 py-4 text-sm",children:t.pricing})]},t.id))})]})})]}),s==="errors"&&e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-6",children:[e.jsx(j,{className:"w-5 h-5 text-emerald-400"}),e.jsx("h2",{className:"text-xl font-semibold",children:"Error Codes"})]}),e.jsx("div",{className:"grid gap-4",children:y.map(t=>e.jsxs("div",{className:"flex items-start gap-4 p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl",children:[e.jsx("span",{className:"px-2 py-1 bg-red-500/10 text-red-400 rounded text-sm font-mono",children:t.code}),e.jsxs("div",{children:[e.jsx("p",{className:"font-medium",children:t.name}),e.jsx("p",{className:"text-sm text-neutral-500",children:t.description})]})]},t.code))})]})]})}export{P as default};
