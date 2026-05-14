import { useState } from "react";
import Library from "@/components/Library";
import Reader from "@/components/Reader";
import { Book } from "@/lib/storage";

export default function Home() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);

  return (
    <>
      {!currentBook ? (
        <Library onOpenBook={setCurrentBook} />
      ) : (
        <Reader book={currentBook} onClose={() => setCurrentBook(null)} />
      )}
    </>
  );
}
