import { PrismaClient } from '@prisma/client'
import { parseChart } from '../shared/chartParser.ts'
import { PLAYLIST_SONGS, type SeedSong } from './playlistSongs.ts'
import { MORE_PLAYLIST_SONGS } from './playlistMore.ts'

const prisma = new PrismaClient()

const OCEANS_CHART = `[Intro]
Bm   A/C#   D   A   G

[Verse 1]
Bm                    A/C#         D
You call me out upon the waters
A                              G
The great unknown where feet may fail
Bm                    A/C#         D
And there I find You in the mystery
A                    G
In oceans deep my faith will stand

[Chorus]
G              D             A
And I will call upon Your name
G           D
And keep my eyes
A
Above the waves
G
When oceans rise
D
My soul will rest
A
In Your embrace
G
For I am Yours
A              Bm
And You are mine

[Verse 2]
Bm                    A/C#         D
Your grace abounds in deepest waters
A                              G
Your sovereign hand will be my guide
Bm                    A/C#         D
Where feet may fail and fear surrounds me
A                    G
You've never failed and You won't start now

[Chorus]
G              D             A
So I will call upon Your name
G           D
And keep my eyes
A
Above the waves
G
When oceans rise
D
My soul will rest
A
In Your embrace
G
For I am Yours
A              Bm
And You are mine

[Bridge]
Bm                    G
Spirit lead me where my trust is without borders
D                              A
Let me walk upon the waters wherever You would call me
Bm                    G
Take me deeper than my feet could ever wander
D                              A
And my faith will be made stronger in the presence of my Saviour

Bm                    G
Spirit lead me where my trust is without borders
D                              A
Let me walk upon the waters wherever You would call me
Bm                    G
Take me deeper than my feet could ever wander
D                              A
And my faith will be made stronger in the presence of my Saviour

[Chorus]
G              D             A
I will call upon Your name
G           D
Keep my eyes above the waves
G              D             A
My soul will rest in Your embrace
G        A           Bm
I am Yours and You are mine`

const BEAUTIFUL_NAME_CHART = `[Verse 1]
D
You were the Word at the beginning
G           Bm        A
One with God the Lord Most High
Bm              A/C#       D
Your hidden glory in creation
G           Bm        A
Now revealed in You our Christ

[Chorus 1]
D                              A
What a beautiful Name it is what a beautiful Name it is
Bm        A           G
The Name of Jesus Christ my King
D/F#                           A
What a beautiful Name it is nothing compares to this
Bm        A           G
What a beautiful Name it is the Name of Jesus

[Verse 2]
D
You didn't want heaven without us
G              Bm          A
So Jesus You brought heaven down
Bm              A/C#       D
My sin was great Your love was greater
G           Bm        A
What could separate us now

[Chorus 2]
D                              A
What a wonderful Name it is what a wonderful Name it is
Bm        A           G
The Name of Jesus Christ my King
D/F#                           A
What a wonderful Name it is nothing compares to this
Bm        A           G
What a wonderful Name it is the Name of Jesus
Bm        A           G
What a wonderful Name it is the Name of Jesus

[Bridge 1]
G                    A
Death could not hold You the veil tore before You
Bm7                           F#m
You silenced the boast of sin and grave
G                    A
The heavens are roaring the praise of Your glory
Bm7                  A
For You are raised to life again

[Bridge 2]
G                    A
You have no rival You have no equal
Bm7                           F#m7
Now and forever God You reign
G                    A
Yours is the Kingdom Yours is the glory
Bm7                  A
Yours is the Name above all names

[Chorus 3]
D                              A
What a powerful Name it is what a powerful Name it is
Bm7       A           G
The Name of Jesus Christ my King
D/F#                           A
What a powerful Name it is nothing can stand against
Bm7       A           G
What a powerful Name it is the Name of Jesus

[Bridge 2]
G                    A
You have no rival You have no equal
Bm7                           F#m7
Now and forever God You reign
G                    A
Yours is the Kingdom Yours is the glory
Bm7                  A
Yours is the Name above all names

[Chorus 3]
D                              A
What a powerful Name it is what a powerful Name it is
Bm        A           G
The Name of Jesus Christ my King
D/F#                           A
What a powerful Name it is nothing can stand against
Bm7       A           G
What a powerful Name it is the Name of Jesus
Bm7       A           G
What a powerful Name it is the Name of Jesus
Bm7       A           G
What a powerful Name it is the Name of Jesus`

const CORE_SONGS: SeedSong[] = [
  {
    title: 'Oceans (Where Feet May Fail)',
    artist: 'Hillsong United',
    key: 'D',
    bpm: 64,
    tag: 'Worship',
    chart: OCEANS_CHART,
  },
  {
    title: 'What A Beautiful Name',
    artist: 'Hillsong Worship',
    key: 'D',
    bpm: 68,
    tag: 'Praise',
    chart: BEAUTIFUL_NAME_CHART,
  },
]

const SONGS: SeedSong[] = [...CORE_SONGS, ...PLAYLIST_SONGS, ...MORE_PLAYLIST_SONGS]

async function upsertOne(client: PrismaClient, song: SeedSong) {
  const { sections, warnings } = parseChart(song.chart)
  if (warnings.length) {
    console.warn(`${song.title} parse notes:`, warnings.map((w) => w.message))
  }
  const payload = {
    title: song.title,
    artist: song.artist,
    album: song.album ?? null,
    key: song.key,
    bpm: song.bpm,
    tag: song.tag,
    durationSeconds: song.durationSeconds ?? null,
    timeSignature: '4/4',
    sections: {
      create: sections.map((s) => ({
        label: s.label,
        order: s.order,
        lines: {
          create: s.lines.map((l) => ({
            chords: l.chords,
            lyric: l.lyric,
            order: l.order,
          })),
        },
      })),
    },
  }

  const existing = await client.song.findFirst({
    where: { title: song.title, artist: song.artist },
  })

  if (existing) {
    await client.$transaction(async (tx) => {
      await tx.line.deleteMany({ where: { section: { songId: existing.id } } })
      await tx.section.deleteMany({ where: { songId: existing.id } })
      await tx.song.update({
        where: { id: existing.id },
        data: payload,
      })
    })
    console.log(`Updated ${song.title}`)
    return existing.id
  }
  const created = await client.song.create({ data: payload })
  console.log(`Created ${song.title}`)
  return created.id
}

function nextSunday(): Date {
  const d = new Date()
  d.setHours(10, 0, 0, 0)
  const day = d.getDay()
  const add = day === 0 ? 0 : 7 - day
  d.setDate(d.getDate() + add)
  return d
}

export async function ensureDemoData(client: PrismaClient = prisma) {
  await client.preference.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      theme: 'dark',
      presentationFontSize: 'medium',
    },
    update: {},
  })

  if ((await client.setlist.count()) === 0) {
    await client.setlist.createMany({
      data: [
        {
          name: 'Sunday AM',
          serviceName: 'Morning Worship',
          date: nextSunday(),
          colorIndex: 0,
        },
        {
          name: 'Midweek',
          serviceName: 'Wednesday Night',
          colorIndex: 2,
        },
      ],
    })
  }

  await client.setlist.deleteMany({ where: { name: 'Easter' } })

  const first = await client.setlist.findFirst({ orderBy: { createdAt: 'asc' } })
  if (first) {
    const prefs = await client.preference.findUnique({ where: { id: 1 } })
    if (!prefs?.lastSetlistId) {
      await client.preference.update({
        where: { id: 1 },
        data: { lastSetlistId: first.id },
      })
    }
  }

  const songCount = await client.song.count()
  const hasPlaylist = await client.song.findFirst({
    where: { title: { contains: 'Never Walk Alone' } },
  })
  const hasMore = await client.song.findFirst({
    where: { title: { contains: 'Been So Good' } },
  })
  if (songCount === 0 || !hasPlaylist || !hasMore) {
    await upsertWorshipSongs(client)
  }

  await client.setlistSong.deleteMany({
    where: { setlist: { name: 'Sunday AM' } },
  })
}

export async function upsertWorshipSongs(client: PrismaClient = prisma) {
  for (const song of SONGS) {
    await upsertOne(client, song)
  }
}

const isMain = process.argv[1]?.includes('upsertSongs')
if (isMain) {
  upsertWorshipSongs()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e)
      await prisma.$disconnect()
      process.exit(1)
    })
}
