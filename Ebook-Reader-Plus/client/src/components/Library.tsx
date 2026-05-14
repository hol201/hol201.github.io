import { useState, useEffect, useRef } from "react";
import { Book, getAllBooks, saveBook, deleteBook } from "@/lib/storage";
import { parseFb2, parseTxt } from "@/lib/fb2Parser";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, 
  Upload, 
  MoreVertical, 
  Trash, 
  BookMarked
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface LibraryProps {
  onOpenBook: (book: Book) => void;
}

export default function Library({ onOpenBook }: LibraryProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadBooks = async () => {
    setIsLoading(true);
    try {
      const storedBooks = await getAllBooks();
      setBooks(storedBooks);
    } catch (error) {
      toast({
        title: "Error loading library",
        description: "Could not retrieve your books.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    const file = files[0];
    
    try {
      let parsedBook;
      let fileType: 'txt' | 'fb2' = 'txt';
      
      const fileName = file.name.toLowerCase();
      
      // Basic detection based on extension or mime type
      if (fileName.endsWith('.fb2') || fileName.endsWith('.xml') || file.type.includes('xml')) {
        fileType = 'fb2';
        parsedBook = await parseFb2(file);
      } else if (fileName.endsWith('.txt') || file.type.includes('text/plain')) {
        fileType = 'txt';
        parsedBook = await parseTxt(file);
      } else {
        // Fallback: try reading the start of the file to guess
        const text = await file.text();
        if (text.includes('<FictionBook')) {
          fileType = 'fb2';
          parsedBook = await parseFb2(file);
        } else {
          fileType = 'txt';
          parsedBook = await parseTxt(file);
        }
      }

      const newBook: Book = {
        id: crypto.randomUUID(),
        title: parsedBook.title,
        author: parsedBook.author,
        coverImage: parsedBook.coverImage,
        content: parsedBook.content,
        toc: parsedBook.toc,
        fileType,
        lastReadPosition: 0,
        bookmarks: [],
        addedAt: Date.now()
      };

      await saveBook(newBook);
      await loadBooks();
      
      toast({
        title: "Book added",
        description: `"${newBook.title}" has been added to your library.`,
      });
      
    } catch (error: any) {
      toast({
        title: "Failed to add book",
        description: error.message || "An error occurred while parsing the file.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the book
    if (confirm("Are you sure you want to remove this book?")) {
      await deleteBook(id);
      await loadBooks();
      toast({
        description: "Book removed from library.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Library
        </h1>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
        />
        
        <Button onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          Add Book
        </Button>
      </header>

      <main className="p-6 md:p-8 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
              <BookMarked className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Your library is empty</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              Upload your favorite books in FB2 or TXT format to start reading. 
              Your books and progress are saved securely on your device.
            </p>
            <Button size="lg" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-5 w-5 mr-2" />
              Upload First Book
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {books.map((book) => (
              <div 
                key={book.id} 
                className="group relative flex flex-col gap-3 cursor-pointer"
                onClick={() => onOpenBook(book)}
              >
                <div className="relative aspect-[2/3] w-full rounded-md overflow-hidden bg-muted shadow-sm hover:shadow-md transition-shadow">
                  {book.coverImage ? (
                    <img 
                      src={book.coverImage} 
                      alt={`Cover of ${book.title}`} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full p-4 flex flex-col items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-center">
                      <h3 className="font-serif font-bold text-sm line-clamp-4">{book.title}</h3>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{book.author}</p>
                    </div>
                  )}
                  
                  {/* Progress bar */}
                  {book.lastReadPosition > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                      <div className="h-full bg-primary" style={{ width: '10%' }}></div>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-sm line-clamp-1 leading-tight">{book.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{book.author}</p>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={(e) => handleDelete(book.id, e as any)}>
                        <Trash className="h-4 w-4 mr-2" />
                        Remove Book
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
