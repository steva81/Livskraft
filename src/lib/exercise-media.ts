export type Exercise = {name:string;sets:number;reps:string;durationMin?:number;instruction?:string;beginnerModification?:string;video?:{youtubeId:string;verifiedAt:string;sourceUrl:string}}
export function exerciseVideoUrl(exercise:Exercise):string|null {
  const video=exercise.video
  if (!video || !/^[A-Za-z0-9_-]{11}$/.test(video.youtubeId) || !/^\d{4}-\d{2}-\d{2}$/.test(video.verifiedAt)) return null
  try {
    const source=new URL(video.sourceUrl)
    if (source.protocol!=="https:" || !["www.youtube.com","youtube.com"].includes(source.hostname) || source.pathname!=="/watch" || source.searchParams.get("v")!==video.youtubeId) return null
  } catch { return null }
  return `https://www.youtube-nocookie.com/embed/${video.youtubeId}`
}
export function exerciseInstruction(exercise:Exercise):string {
  if (exercise.instruction) return exercise.instruction
  const name=exercise.name.toLowerCase()
  if (/knäböj|benböj/.test(name)) return "Stå stadigt, böj höft och knän och låt knäna följa tårnas riktning. Res dig kontrollerat."
  if (/höften högt/.test(name)) return "Placera händer och fötter stadigt, håll höften högt och sänk huvudet kontrollerat mellan händerna. Pressa tillbaka utan att belasta nacken."
  if (/benpress/.test(name)) return "Placera fötterna stabilt på plattan. Böj knäna kontrollerat och pressa tillbaka utan att låsa dem; behåll ryggen mot stödet."
  if (/vadpress/.test(name)) return "Stå stadigt med stöd vid behov. Lyft hälarna långsamt och sänk dem kontrollerat."
  if (/bänkpress|bröstpress/.test(name)) return "Håll skuldrorna stabila mot stödet. Sänk vikten kontrollerat och pressa upp utan att låsa armbågarna. Be om hjälp med inställning och passning vid behov."
  if (/latsdrag/.test(name)) return "Sitt stabilt och dra handtaget mot övre bröstet med armbågarna nedåt. Återgå långsamt utan att gunga."
  if (/axelpress/.test(name)) return "Håll bålen stabil och pressa vikten uppåt framför huvudet. Sänk kontrollerat till en bekväm höjd utan att svanka."
  if (/armhäv/.test(name)) return "Håll kroppen rak och sänk bröstet kontrollerat mot underlaget. Pressa tillbaka; välj vägg för en lättare variant."
  if (/planka/.test(name)) return "Stöd på underarmar och tår eller knän. Håll kroppen i en bekväm rak linje och fortsätt andas."
  if (/rodd/.test(name)) return "Håll ryggen stabil, dra armbågarna bakåt och återgå långsamt utan att rycka."
  if (/höftlyft/.test(name)) return "Ligg på rygg med böjda knän och fötterna i golvet. Lyft höften lugnt och sänk kontrollerat."
  if (/utfall/.test(name)) return "Ta ett stabilt steg, böj båda knäna och res dig kontrollerat. Använd stöd vid behov."
  return "Utför rörelsen lugnt med en belastning du kan kontrollera. Avbryt vid smärta och be en instruktör visa övningen om tekniken är oklar."
}
