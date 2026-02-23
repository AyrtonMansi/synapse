import{j as e}from"./vendor-wagmi-vFUbRHPB.js";import{r as i}from"./vendor-react-Dw6xBsqb.js";import{C as h}from"./chevron-right-DOZdDRCj.js";import{c as b,T as u}from"./index-DKXM9sTJ.js";import{C as c}from"./check-CYAc-h0H.js";import{C as m}from"./copy-CgSLxoRJ.js";import{C as g}from"./code-CZQVbs8V.js";import{E as f}from"./external-link-C4XP0NnV.js";/**
 * @license lucide-react v0.294.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=b("Package",[["path",{d:"m7.5 4.27 9 5.15",key:"1c824w"}],["path",{d:"M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",key:"hh9hay"}],["path",{d:"m3.3 7 8.7 5 8.7-5",key:"g66t2b"}],["path",{d:"M12 22V12",key:"d0xqtd"}]]),r=[{id:"javascript",name:"JavaScript / TypeScript",icon:"JS",color:"text-yellow-400",install:"npm install @synapse/sdk",description:"Official JavaScript SDK for Node.js and browsers",features:["TypeScript support","Browser & Node.js","Streaming support","Error handling"]},{id:"python",name:"Python",icon:"PY",color:"text-blue-400",install:"pip install synapse-sdk",description:"Official Python SDK for AI applications",features:["Async support","Pydantic models","Streaming support","Type hints"]},{id:"go",name:"Go",icon:"GO",color:"text-cyan-400",install:"go get github.com/synapse/sdk-go",description:"Official Go SDK for high-performance applications",features:["Context support","Retries & backoff","Streaming support","Mocking"]}],N=`import { SynapseClient } from '@synapse/sdk';

const client = new SynapseClient({
  apiKey: process.env.SYNAPSE_API_KEY,
});

// Simple completion
const response = await client.chat.completions.create({
  model: 'llama-3-70b',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);

// Streaming
const stream = await client.chat.completions.create({
  model: 'llama-3-70b',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}`,w=`import os
from synapse import SynapseClient

client = SynapseClient(
    api_key=os.environ["SYNAPSE_API_KEY"]
)

# Simple completion
response = client.chat.completions.create(
    model="llama-3-70b",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)

# Streaming
stream = client.chat.completions.create(
    model="llama-3-70b",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")`,y=`package main

import (
    "context"
    "fmt"
    "os"
    
    "github.com/synapse/sdk-go"
)

func main() {
    client := synapse.NewClient(os.Getenv("SYNAPSE_API_KEY"))
    
    // Simple completion
    resp, err := client.Chat.Completions.Create(context.Background(), synapse.ChatCompletionRequest{
        Model: "llama-3-70b",
        Messages: []synapse.Message{
            {Role: "user", Content: "Hello!"},
        },
    })
    if err != nil {
        panic(err)
    }
    
    fmt.Println(resp.Choices[0].Message.Content)
}`,d={javascript:N,python:w,go:y};function T(){const[t,p]=i.useState("javascript"),[a,n]=i.useState(null),o=(s,x)=>{navigator.clipboard.writeText(s),n(x),setTimeout(()=>n(null),2e3)},l=r.find(s=>s.id===t);return e.jsxs("div",{className:"max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8",children:[e.jsxs("div",{className:"flex items-center gap-2 text-sm text-neutral-400 mb-8",children:[e.jsx("a",{href:"/docs",className:"hover:text-emerald-400 transition-colors",children:"Docs"}),e.jsx(h,{className:"w-4 h-4"}),e.jsx("span",{className:"text-white",children:"SDK"})]}),e.jsxs("div",{className:"mb-12",children:[e.jsxs("div",{className:"inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-6",children:[e.jsx(j,{className:"w-4 h-4"}),"SDK Documentation"]}),e.jsx("h1",{className:"text-4xl font-bold mb-4",children:"Synapse SDKs"}),e.jsx("p",{className:"text-neutral-400 text-lg",children:"Official SDKs for interacting with the Synapse API. Choose your preferred language and start building in minutes."})]}),e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-4 mb-8",children:r.map(s=>e.jsxs("button",{onClick:()=>p(s.id),className:`p-4 text-left border rounded-xl transition-all ${t===s.id?"border-emerald-500/50 bg-emerald-500/5":"border-white/[0.08] bg-white/[0.03] hover:border-white/[0.12]"}`,children:[e.jsxs("div",{className:"flex items-center gap-3 mb-2",children:[e.jsx("span",{className:`w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-xs font-bold ${s.color}`,children:s.icon}),e.jsx("h3",{className:"font-semibold",children:s.name})]}),e.jsx("p",{className:"text-sm text-neutral-500",children:s.description})]},s.id))}),e.jsxs("div",{className:"mb-8",children:[e.jsxs("h2",{className:"text-xl font-semibold mb-4 flex items-center gap-2",children:[e.jsx(u,{className:"w-5 h-5 text-emerald-400"}),"Installation"]}),e.jsxs("div",{className:"bg-[#0a0a0a] border border-white/[0.08] rounded-xl overflow-hidden",children:[e.jsxs("div",{className:"flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/[0.08]",children:[e.jsx("span",{className:"text-xs text-neutral-500",children:"Terminal"}),e.jsxs("button",{onClick:()=>o(l.install,"install"),className:"text-xs text-neutral-500 hover:text-emerald-400 transition-colors flex items-center gap-1",children:[a==="install"?e.jsx(c,{className:"w-3 h-3"}):e.jsx(m,{className:"w-3 h-3"}),a==="install"?"Copied!":"Copy"]})]}),e.jsx("div",{className:"p-4",children:e.jsx("code",{className:"text-sm font-mono text-neutral-300",children:l.install})})]})]}),e.jsxs("div",{className:"mb-8",children:[e.jsx("h2",{className:"text-xl font-semibold mb-4",children:"Features"}),e.jsx("div",{className:"grid grid-cols-2 gap-3",children:l.features.map(s=>e.jsxs("div",{className:"flex items-center gap-2 p-3 bg-white/[0.03] border border-white/[0.08] rounded-lg",children:[e.jsx("div",{className:"w-2 h-2 bg-emerald-400 rounded-full"}),e.jsx("span",{className:"text-sm",children:s})]},s))})]}),e.jsxs("div",{className:"mb-8",children:[e.jsxs("h2",{className:"text-xl font-semibold mb-4 flex items-center gap-2",children:[e.jsx(g,{className:"w-5 h-5 text-emerald-400"}),"Usage Example"]}),e.jsxs("div",{className:"bg-[#0a0a0a] border border-white/[0.08] rounded-xl overflow-hidden",children:[e.jsxs("div",{className:"flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/[0.08]",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"w-3 h-3 rounded-full bg-red-500/80"}),e.jsx("div",{className:"w-3 h-3 rounded-full bg-yellow-500/80"}),e.jsx("div",{className:"w-3 h-3 rounded-full bg-green-500/80"})]}),e.jsxs("button",{onClick:()=>o(d[t],"code"),className:"text-xs text-neutral-500 hover:text-emerald-400 transition-colors flex items-center gap-1",children:[a==="code"?e.jsx(c,{className:"w-3 h-3"}):e.jsx(m,{className:"w-3 h-3"}),a==="code"?"Copied!":"Copy"]})]}),e.jsx("div",{className:"p-4 overflow-x-auto",children:e.jsx("pre",{className:"text-sm font-mono",children:e.jsx("code",{className:"text-neutral-300",children:d[t]})})})]})]}),e.jsxs("div",{className:"bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl p-6",children:[e.jsx("h2",{className:"text-xl font-semibold mb-4",children:"Open Source"}),e.jsx("p",{className:"text-neutral-400 mb-4",children:"All SDKs are open source and available on GitHub. Contributions are welcome!"}),e.jsx("div",{className:"flex flex-wrap gap-3",children:r.map(s=>e.jsxs("a",{href:`https://github.com/synapse/sdk-${s.id}`,target:"_blank",rel:"noopener noreferrer",className:"flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg hover:bg-white/[0.08] transition-colors",children:[e.jsx("span",{className:`text-xs font-bold ${s.color}`,children:s.icon}),e.jsx("span",{className:"text-sm",children:s.name}),e.jsx(f,{className:"w-3 h-3 text-neutral-500"})]},s.id))})]})]})}export{T as default};
