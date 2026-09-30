import { Fragment } from "react"

function inline(text:string) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part,index)=>part.startsWith("**")&&part.endsWith("**")
    ? <strong key={index}>{part.slice(2,-2)}</strong> : <Fragment key={index}>{part}</Fragment>)
}
// Only paragraphs, lists and bold. Everything else stays escaped React text.
export function CoachText({text}:{text:string}) {
  const blocks:{kind:"p"|"ul"|"ol";lines:string[]}[]=[]
  for (const line of text.replace(/\r\n/g,"\n").split("\n")) {
    if (!line.trim()) {blocks.push({kind:"p",lines:[]});continue}
    const bullet=line.match(/^\s*[-*•]\s+(.+)$/),numbered=line.match(/^\s*\d+[.)]\s+(.+)$/)
    const kind=bullet?"ul":numbered?"ol":"p",content=bullet?.[1]??numbered?.[1]??line
    const previous=blocks.at(-1)
    if (previous?.kind===kind && previous.lines.length) previous.lines.push(content)
    else blocks.push({kind,lines:[content]})
  }
  return <div className="space-y-2">{blocks.filter(block=>block.lines.length).map((block,index)=>block.kind==="p"
    ? <p key={index} className="whitespace-pre-wrap">{inline(block.lines.join("\n"))}</p>
    : block.kind==="ul" ? <ul key={index} className="list-disc pl-5 space-y-1">{block.lines.map((line,i)=><li key={i}>{inline(line)}</li>)}</ul>
    : <ol key={index} className="list-decimal pl-5 space-y-1">{block.lines.map((line,i)=><li key={i}>{inline(line)}</li>)}</ol>)}</div>
}
