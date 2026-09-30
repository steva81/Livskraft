"use client"
import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "./ui/button"

export function MealCamera({en,onUse,onClose}:{en:boolean;onUse:(file:File)=>void;onClose:()=>void}) {
  const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),generation=useRef(0),pending=useRef<Promise<MediaStream>|null>(null)
  const [still,setStill]=useState<File|null>(null),[url,setUrl]=useState<string|null>(null),[error,setError]=useState(""),[ready,setReady]=useState(false)
  const t=(sv:string,english:string)=>en?english:sv
  const stop=()=>{generation.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;setReady(false)}
  const start=async()=>{
    stop();setError("");setStill(null);setUrl(null)
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){setError(t("Direktkamera är inte tillgänglig i den här webbläsaren eller anslutningen. Välj en bild i stället.","Direct camera access is not available in this browser or connection. Choose an existing image instead."));return}
    const ticket=generation.current
    try{
      // Serialize permission requests, including React's development effect replay.
      if(pending.current){try{await pending.current}catch{/* The previous request reports its own error. */}}
      if(ticket!==generation.current)return
      const request=navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"}}})
      pending.current=request
      let next:MediaStream
      try{next=await request}finally{if(pending.current===request)pending.current=null}
      if(ticket!==generation.current){next.getTracks().forEach(track=>track.stop());return}
      stream.current=next
      next.getVideoTracks().forEach(track=>{track.onended=()=>{if(stream.current===next){stop();setError(t("Kameran stängdes. Försök igen eller välj en bild.","The camera stopped. Try again or choose an image."))}}})
      if(video.current){video.current.srcObject=next;await video.current.play()}
    }catch(reason){
      if(ticket!==generation.current)return
      stop();const name=reason instanceof Error?reason.name:""
      setError(name==="NotAllowedError"?t("Kameratillstånd nekades. Tillåt kameran i webbläsaren eller välj en bild.","Camera permission was denied. Allow the camera in your browser or choose an image."):name==="NotFoundError"?t("Ingen kamera hittades. Välj en bild i stället.","No camera was found. Choose an image instead."):t("Kameran kunde inte öppnas. Den kan vara upptagen. Försök igen eller välj en bild.","Could not open the camera. It may be in use. Try again or choose an image."))
    }
  }
  useEffect(()=>{void start();return()=>{generation.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null}},[]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url)},[url])
  const capture=()=>{
    const source=video.current
    if(!source?.videoWidth||!source.videoHeight)return
    const canvas=document.createElement("canvas")
    canvas.width=source.videoWidth;canvas.height=source.videoHeight
    const context=canvas.getContext("2d");if(!context)return
    context.drawImage(source,0,0,canvas.width,canvas.height)
    const ticket=generation.current
    canvas.toBlob(blob=>{
      if(ticket!==generation.current)return
      if(!blob){setError(t("Bilden kunde inte tas. Försök igen.","Could not capture the image. Try again."));return}
      stop();const file=new File([blob],"meal-camera.jpg",{type:"image/jpeg"});setStill(file);setUrl(URL.createObjectURL(file))
    },"image/jpeg",0.9)
  }
  return <section aria-label={t("Måltidskamera","Meal camera")} className="space-y-4 rounded-2xl border border-[#e6eadd] bg-[#fcfdfa] p-4 sm:p-5 shadow-sm">
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#17291f] shadow-inner">
      {url?<Image unoptimized fill sizes="(max-width: 768px) 100vw, 800px" src={url} alt={t("Tagen bild","Captured image")} className="object-contain"/>:<video ref={video} autoPlay muted playsInline onLoadedData={()=>{if(stream.current)setReady(true)}} className="h-full w-full object-cover"/>}
    </div>
    {error&&<p role="alert" className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">{error}</p>}
    <div className="flex flex-wrap gap-3">
      {still?<><Button type="button" variant="outline" className="h-11 rounded-xl border-[#d3dfd6] text-[#244d36] hover:bg-[#f0f5eb]" onClick={()=>void start()}>{t("Ta om","Retake")}</Button><Button type="button" className="h-11 rounded-xl bg-[#244d36] hover:bg-[#1a3827] text-white px-6" onClick={()=>{stop();onUse(still);onClose()}}>{t("Använd bild","Use image")}</Button></>:<Button type="button" className="h-11 rounded-xl bg-[#244d36] hover:bg-[#1a3827] text-white px-6" disabled={!ready} onClick={capture}>{t("Ta bild","Capture photo")}</Button>}
      <Button type="button" variant="outline" className="h-11 rounded-xl border-transparent text-[#617064] hover:bg-[#f0f5eb] hover:text-[#244d36]" onClick={()=>{stop();onClose()}}>{t("Avbryt kamera","Cancel camera")}</Button>
    </div>
  </section>
}
