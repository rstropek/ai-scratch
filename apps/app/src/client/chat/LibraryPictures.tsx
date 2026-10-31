// What search_library found, as pictures with their names: a kid can't tell "Shark" from "Shark 2" by name.
// The tool result only has names (pictures would cost the model tokens), so the pictures come from the same
// library files the tool searched, and the images from the Scratch CDN like in the editor's library dialogs.
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { fetchLibrary, type LibraryItem, type LibraryKind, libraryPictureUrl } from '../../shared/tools/asset-tools.ts';

const libraries = new Map<LibraryKind, Promise<LibraryItem[]>>();
const library = (kind: LibraryKind) => {
  let items = libraries.get(kind);
  if (!items) {
    items = fetchLibrary(kind);
    libraries.set(kind, items);
    items.catch(() => libraries.delete(kind));
  }
  return items;
};

interface Picture {
  name: string;
  url?: string;
}

export const LibraryPictures = ({ kind, names }: { kind: LibraryKind; names: string[] }) => {
  const [pictures, setPictures] = useState<Picture[]>(names.map((name) => ({ name })));
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const key = names.join('\n');
  useEffect(() => {
    let current = true;
    library(kind)
      .then((items) => {
        const byName = new Map(items.map((i) => [i.name, i]));
        const found = key.split('\n').map((name) => {
          const item = byName.get(name);
          return { name, url: item && libraryPictureUrl(item) };
        });
        if (current) setPictures(found);
      })
      .catch(() => undefined); // the names stay
    return () => {
      current = false;
    };
  }, [kind, key]);
  return (
    <div className="flex max-w-[90%] flex-wrap gap-2" data-testid="library-pictures">
      {pictures.map(({ name, url }) => (
        <figure
          key={name}
          className="flex w-20 flex-col items-center gap-0.5 rounded-lg border bg-white p-1 text-center text-[0.75em]"
        >
          <div className={cn('flex w-full items-center justify-center', kind === 'backdrop' ? 'h-[3.4rem]' : 'h-16')}>
            {url && !broken.has(name) && (
              <img
                src={url}
                alt={name}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
                onError={() => setBroken((b) => new Set(b).add(name))}
              />
            )}
          </div>
          <figcaption className="w-full leading-tight [overflow-wrap:anywhere]">{name}</figcaption>
        </figure>
      ))}
    </div>
  );
};
