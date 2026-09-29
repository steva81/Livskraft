"use client"
import { createContext, useContext, useEffect, useState, Children, isValidElement, cloneElement, type ReactNode, type ReactElement } from "react"
import { useSession } from "next-auth/react"
import { getUser, savePreferences } from "@/app/actions"
import { readPreferences } from "@/lib/preferences"
import { translate, type Language } from "./catalog"
const LanguageContext=createContext({language:"sv" as Language,ready:false,setLanguage:async(_language:Language)=>{void _language}})
export function LanguageProvider({children,initialLanguage="sv",initialUserId=null}:{children:ReactNode;initialLanguage?:Language;initialUserId?:string|null}) {
  const {data:session,status}=useSession()
  const [language,setValue]=useState<Language>(initialLanguage),[ready,setReady]=useState(!!initialUserId)
  const [loadedFor,setLoadedFor]=useState(initialUserId)
  useEffect(()=>{
    let active=true
    if(status==="loading") return
    // The server-provided locale is authoritative for the initial authenticated render.
    if(session?.user?.id===initialUserId && initialUserId){setValue(initialLanguage);setLoadedFor(initialUserId);setReady(true);return}
    setReady(false)
    if(session?.user?.id) getUser().then(user=>{if(active)setValue(readPreferences(user?.preferences??null).language)}).catch(()=>{if(active)setValue("sv")}).finally(()=>{if(active){setLoadedFor(session.user.id);setReady(true)}})
    else {try{setValue(localStorage.getItem("livskraft-language")==="en"?"en":"sv")}catch{setValue("sv")}setLoadedFor(null);setReady(true)}
    return ()=>{active=false}
  },[session?.user?.id,status,initialUserId,initialLanguage])
  useEffect(()=>{document.documentElement.lang=language},[language])
  const setLanguage=async(value:Language)=>{if(session?.user?.id) await savePreferences({language:value});try{localStorage.setItem("livskraft-language",value)}catch{/* Browser storage is optional; the database remains authoritative. */}setValue(value)}
  const changingUser=!!session?.user?.id&&loadedFor!==session.user.id
  return <LanguageContext.Provider value={{language,ready:ready&&!changingUser,setLanguage}}>{changingUser?<div role="status" aria-label="Loading / Laddar" className="p-8 text-center">…</div>:children}</LanguageContext.Provider>
}
export function useLanguage(){return useContext(LanguageContext)}
export function LanguageSelector(){
  const {language,setLanguage,ready}=useLanguage(),[saving,setSaving]=useState(false),[error,setError]=useState(false)
  return <div className="text-sm"><label>{language==="en"?"Language":"Språk"} <select aria-label={language==="en"?"Language":"Språk"} className="border rounded p-2" disabled={!ready||saving} value={language} onChange={async e=>{setSaving(true);setError(false);try{await setLanguage(e.target.value as Language)}catch{setError(true)}finally{setSaving(false)}}}><option value="sv">Svenska</option><option value="en">English</option></select></label>{error&&<p role="alert">{language==="en"?"Could not save language.":"Kunde inte spara språk."}</p>}</div>
}
// Translate rendered React text and display attributes using the static source-key catalog.
// Values, event handlers, identifiers, user-authored content and stored enums are untouched.
export function Localize({children}:{children:ReactNode}) {
  const {language}=useLanguage()
  function visit(node:ReactNode):ReactNode {
    if(typeof node==="string") return translate(node,language)
    if(!isValidElement(node)) return node
    const el=node as ReactElement<Record<string,unknown>>
    if(el.props["data-localize"]==="off") return el
    const props:Record<string,unknown>={}
    for(const attr of ["aria-label","title","placeholder","alt"]) if(typeof el.props[attr]==="string") props[attr]=translate(el.props[attr] as string,language)
    if(el.props.children!==undefined) props.children=Children.map(el.props.children as ReactNode,visit)
    return cloneElement(el,props)
  }
  return <>{Children.map(children,visit)}</>
}
