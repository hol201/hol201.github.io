import localforage from 'localforage';

export interface Book {
  id: string;
  title: string;
  author: string;
  coverImage?: string;
  content: string; // Plain text or parsed HTML content
  fileType: 'txt' | 'fb2';
  lastReadPosition: number; // e.g. scroll offset or paragraph index
  bookmarks?: { id: string, text: string, date: number }[];
  toc?: { id: string; title: string; level: number }[];
  addedAt: number;
}

export const booksStore = localforage.createInstance({
  name: 'EbookReader',
  storeName: 'books'
});

export async function saveBook(book: Book): Promise<void> {
  await booksStore.setItem(book.id, book);
}

export async function getBook(id: string): Promise<Book | null> {
  return await booksStore.getItem<Book>(id);
}

export async function getAllBooks(): Promise<Book[]> {
  const books: Book[] = [];
  await booksStore.iterate((value: Book) => {
    books.push(value);
  });
  return books.sort((a, b) => b.addedAt - a.addedAt);
}

export async function deleteBook(id: string): Promise<void> {
  await booksStore.removeItem(id);
}

export async function updateReadingPosition(id: string, position: number): Promise<void> {
  const book = await getBook(id);
  if (book) {
    book.lastReadPosition = position;
    await saveBook(book);
  }
}
