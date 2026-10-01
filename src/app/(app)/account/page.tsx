"use client"
import { PageHeading } from "@/components/page-heading"
import {useEffect,useState} from "react"
import {signIn,signOut} from "next-auth/react"
import {getUser,changeAccountPassword,type PublicUser} from "@/app/actions"
import {Localize,LanguageSelector} from "@/lib/i18n/provider"
import {Button} from "@/components/ui/button"
import {AICoachInformation} from "@/components/ai-coach-preference"
export default function Account(){
 const [user,setUser]=useState<PublicUser|null>(null),[current,setCurrent]=useState(""),[next,setNext]=useState(""),[confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("")
 useEffect(()=>{getUser().then(setUser).catch(()=>setMessage("Kunde inte ladda profilen. Försök igen."))},[])
 return <Localize><div className="app-page settings-page max-w-3xl mx-auto space-y-6"><PageHeading section="account" /><p data-localize="off">{user?.name}<br/>{user?.email}</p><p className="text-sm">E-postadressen kan inte ändras här eftersom verifiering av en ny adress ännu saknas.</p><LanguageSelector/>{user&&<AICoachInformation key={user.id}/>}<form className="wellness-panel p-5 sm:p-6 space-y-4" onSubmit={async e=>{
  e.preventDefault()
  if(!user || busy)return
  if(next!==confirm){setMessage("Lösenorden matchar inte.");return}
  const renewalFailure="Lösenordet har ändrats, men sessionen kunde inte förnyas. Logga in igen med ditt nya lösenord."
  let passwordChanged=false
  setMessage("")
  setBusy(true)
  try{
   const result=await changeAccountPassword(current,next)
   if(!result.success){setMessage("Kontrollera nuvarande lösenord och välj 10–256 tecken.");return}
   passwordChanged=true
   const login=await signIn("credentials",{redirect:false,email:user.email,password:next})
   setMessage(login?.ok && !login.error?"Ditt lösenord har ändrats. Du är fortfarande inloggad.":renewalFailure)
  }catch{
   setMessage(passwordChanged?renewalFailure:"Kunde inte spara. Försök igen.")
  }finally{
   if(passwordChanged){setCurrent("");setNext("");setConfirm("")}
   setBusy(false)
  }
 }}><h2 className="font-semibold">Byt lösenord</h2>{[["Nuvarande lösenord",current,setCurrent,"current-password"],["Nytt lösenord",next,setNext,"new-password"],["Bekräfta nytt lösenord",confirm,setConfirm,"new-password"]].map(([label,value,setter,autocomplete])=><label className="block text-sm" key={label as string}>{label as string}<input required type="password" autoComplete={autocomplete as string} minLength={label==="Nuvarande lösenord"?1:10} maxLength={256} className="w-full border rounded p-2" value={value as string} onChange={e=>(setter as (v:string)=>void)(e.target.value)}/></label>)}<p className="text-sm">Efter lösenordsbytet förnyas din session här. På andra enheter behöver du logga in igen.</p><Button disabled={busy || !user}>Spara nytt lösenord</Button></form><p role="status">{message}</p><Button variant="outline" onClick={()=>signOut({callbackUrl:"/login"})}>Logga ut</Button></div></Localize>
}
