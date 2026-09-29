import Image from "next/image"
import styles from "./welcome-collage.module.css"

const photos = ["cooking", "meal", "balance", "strength", "outdoors", "calm"]

/** Bounded image cards for the public welcome flow; never a page background. */
export function WelcomeCollage() {
  return <div className={styles.collage} aria-hidden="true">
    {photos.map((photo, index) => <div className={styles.tile} key={photo}>
      <Image className={styles.photo} src={`/images/lifestyle/${photo}.webp`}
        alt="" width={768} height={640} unoptimized priority={index === 0}
        sizes={index === 0 ? "(min-width: 1024px) 380px, 65vw" : "(min-width: 1024px) 190px, 32vw"} />
    </div>)}
  </div>
}
