"use client"
import { Localize } from "@/lib/i18n/provider"

import * as Dialog from "@radix-ui/react-dialog"
import { exerciseInstruction, exerciseVideoUrl, type Exercise } from "@/lib/exercise-media"
export function ExerciseHelp({exercise}:{exercise:Exercise}) {
  const url=exerciseVideoUrl(exercise)
  return <Localize>{<div className="basis-full space-y-2 text-sm"><details><summary className="cursor-pointer min-h-11 py-3">Teknik och enklare alternativ</summary><p className="text-muted-foreground">{exerciseInstruction(exercise)}</p></details>{exercise.beginnerModification && <p>{exercise.beginnerModification}</p>}
    {url && <Dialog.Root><Dialog.Trigger className="underline text-primary min-h-11">Visa instruktionsvideo</Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 bg-black/60 z-50"/><Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-4 max-h-[90dvh] overflow-auto"><Dialog.Title className="font-semibold">{exercise.name}</Dialog.Title><Dialog.Description className="text-sm mb-3">Video från extern tjänst. Textinstruktionen finns kvar i passet.</Dialog.Description><iframe className="aspect-video w-full" src={url} title={exercise.name} allowFullScreen referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation"/><Dialog.Close className="min-h-11 border rounded px-4 mt-3">Stäng och återgå till passet</Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>}
  </div>}</Localize>
}
