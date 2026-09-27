"use client"
import { createContext, useContext, useEffect, useState, Children, isValidElement, cloneElement, type ReactNode, type ReactElement } from "react"
import { useSession } from "next-auth/react"
import { getUser, savePreferences } from "@/app/actions"
import { readPreferences } from "@/lib/preferences"
import { translate, type Language } from "./catalog"
const LanguageContext=createContext({language:"sv" as Language,ready:false,setLanguage:async(_language:Language)=>{void _language}})
export function LanguageProvider({children}:{children:ReactNode}) {
  const {data:session,status}=useSession()
  const [language,setValue]=useState<Language>("sv"),[ready,setReady]=useState(false)
  useEffect(()=>{
    let active=true
    setReady(false)
    if(status==="loading") return
    if(session?.user?.id) getUser().then(user=>{if(active)setValue(readPreferences(user?.preferences??null).language)}).catch(()=>{if(active)setValue("sv")}).finally(()=>{if(active)setReady(true)})
    else {setValue(localStorage.getItem("livskraft-language")==="en"?"en":"sv");setReady(true)}
    return ()=>{active=false}
  },[session?.user?.id,status])
  useEffect(()=>{document.documentElement.lang=language},[language])
  const setLanguage=async(value:Language)=>{if(session?.user?.id) await savePreferences({language:value});localStorage.setItem("livskraft-language",value);setValue(value)}
  return <LanguageContext.Provider value={{language,ready,setLanguage}}>{children}</LanguageContext.Provider>
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
