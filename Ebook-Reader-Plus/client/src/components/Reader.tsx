import { useState, useRef, useEffect, useCallback } from "react";
import { Book, saveBook, updateReadingPosition } from "@/lib/storage";
import { useSettingsStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { 
  ChevronLeft, 
  ChevronRight, 
  Settings2, 
  Bookmark, 
  List, 
  Search as SearchIcon,
  X,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ReaderProps {
  book: Book;
  onClose: () => void;
}

export default function Reader({ book, onClose }: ReaderProps) {
  const [_, setLocation] = useLocation();
  const settings = useSettingsStore();
  const { toast } = useToast();

  // UI State
  const [showControls, setShowControls] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{id: string, text: string, index: number}[]>([]);

  // Pagination State
  const [columnWidth, setColumnWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Apply Settings to Content
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.setProperty('--reader-font-family', settings.fontFamily);
      contentRef.current.style.setProperty('--reader-font-size', `${settings.fontSize}px`);
      contentRef.current.style.setProperty('--reader-line-height', `${settings.lineHeight}`);

      // Force recalculation of pages when settings change
      calculatePagination();
    }
  }, [settings.fontFamily, settings.fontSize, settings.lineHeight, book.content]);

  useEffect(() => {
    if (!contentRef.current) return;

    const headings = contentRef.current.querySelectorAll("h1, h2, h3");

    headings.forEach((el, i) => {
      if (!el.id) {
        el.id = `heading-${i}`;
      }
    });
  }, [book.content]);

  // Calculate pages based on CSS columns
  const calculatePagination = useCallback(() => {
    if (!containerRef.current || !contentRef.current) return;

    // We use CSS columns for pagination. The container has overflow-hidden, 
    // and content is split into columnWidth columns.
    const containerWidth = containerRef.current.clientWidth;
    setColumnWidth(containerWidth);

    // Slight delay to allow DOM to update before measuring
    setTimeout(() => {
      if (!contentRef.current) return;
      const scrollWidth = contentRef.current.scrollWidth;
      const calculatedPages = Math.ceil(scrollWidth / containerWidth);
      setTotalPages(calculatedPages > 0 ? calculatedPages : 1);

      // Restore position if possible
      if (book.lastReadPosition > 0) {
        // Simple logic to translate scroll position or paragraph to page
        // For a real app, this would find the exact page containing the saved paragraph ID
        const targetPage = Math.floor(book.lastReadPosition / containerWidth);
        if (targetPage >= 0 && targetPage < calculatedPages) {
          setCurrentPage(targetPage);
        }
      }
    }, 100);
  }, [book.lastReadPosition]);

  useEffect(() => {
    calculatePagination();
    window.addEventListener('resize', calculatePagination);
    return () => window.removeEventListener('resize', calculatePagination);
  }, [calculatePagination]);

  const goToPage = (page: number, dir: "next" | "prev" = "next") => {
    if (page >= 0 && page < totalPages) {
      setDirection(dir);
      setCurrentPage(page);

      // Save position
      if (columnWidth > 0) {
        updateReadingPosition(book.id, page * columnWidth);
      }
    }
  };

  const nextPage = () => goToPage(currentPage + 1, "next");
  const prevPage = () => goToPage(currentPage - 1, "prev");

  const handleAddBookmark = async () => {
    if (!contentRef.current || !containerRef.current) return;

    // Find the current visible content to bookmark
    const contentRect = contentRef.current.getBoundingClientRect();
    const currentOffset = currentPage * columnWidth;

    // Find the first paragraph that is visible on the current page
    const paragraphs = Array.from(contentRef.current.querySelectorAll('p, h1, h2, h3, h4, h5, h6'));
    let targetElement = paragraphs[0];

    for (const p of paragraphs) {
      const rect = p.getBoundingClientRect();
      const relativeLeft = rect.left - contentRect.left;

      if (relativeLeft >= currentOffset - 10) { // Slight buffer
        targetElement = p;
        break;
      }
    }

    if (targetElement) {
      const id = targetElement.getAttribute('id') || `generated-id-${Date.now()}`;
      if (!targetElement.getAttribute('id')) targetElement.setAttribute('id', id);

      const text = targetElement.textContent || "Unknown position";
      const snippet = text.length > 50 ? text.substring(0, 50) + "..." : text;

      const newBookmark = {
        id,
        text: snippet,
        date: Date.now()
      };

      const updatedBook = {
        ...book,
        bookmarks: [...(book.bookmarks || []), newBookmark]
      };

      await saveBook(updatedBook);

      // Update local state by mutating the book prop object (since we don't have a state for it here)
      book.bookmarks = updatedBook.bookmarks;

      toast({
        title: "Bookmark added",
        description: `Saved at: "${snippet}"`
      });
    }
  };

  // Interaction handlers
  const handleContentClick = (e: React.MouseEvent) => {
    // If clicking a link, let it happen
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'a') return;

    // Prevent toggling if selecting text
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;

    const clickX = e.clientX;
    const screenWidth = window.innerWidth;

    // Left 25% = prev page, Right 25% = next page, Middle 50% = toggle controls
    if (clickX < screenWidth * 0.25) {
      prevPage();
    } else if (clickX > screenWidth * 0.75) {
      nextPage();
    } else {
      setShowControls(prev => !prev);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        nextPage();
      } else if (e.key === 'ArrowLeft') {
        prevPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);

  // Search logic (simplified for mockup)
  const handleSearch = () => {
    if (!searchQuery.trim() || !contentRef.current) return;

    // Clear previous highlights
    const highlights = contentRef.current.querySelectorAll('.search-match');
    highlights.forEach(h => {
      const parent = h.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(h.textContent || ''), h);
        parent.normalize();
      }
    });

    const paragraphs = Array.from(contentRef.current.querySelectorAll('p'));
    const results: {id: string, text: string, index: number}[] = [];

    paragraphs.forEach((p, index) => {
      const text = p.textContent || "";
      if (text.toLowerCase().includes(searchQuery.toLowerCase())) {
        const id = p.getAttribute('id') || `p-${index}`;
        if (!p.getAttribute('id')) p.setAttribute('id', id);

        results.push({
          id,
          text: text.length > 100 ? text.substring(0, 100) + "..." : text,
          index
        });
      }
    });

    setSearchResults(results);
  };

  const jumpToElement = (id: string) => {
    if (!contentRef.current || !containerRef.current) return;

    // First remove highlights from anywhere
    const existingHighlights = contentRef.current.querySelectorAll('.highlight');
    existingHighlights.forEach(el => el.classList.remove('highlight'));

    const element = contentRef.current.querySelector(`[id="${id}"]`) as HTMLElement;
    if (element) {
      // Highlight element temporarily
      element.classList.add('highlight');
      setTimeout(() => element.classList.remove('highlight'), 3000);

      const elementLeft = element.offsetLeft;
      const targetPage = Math.floor(elementLeft / columnWidth);

      if (targetPage >= 0 && targetPage < totalPages) {
        setCurrentPage(targetPage);
        setShowSearch(false);
        setShowToc(false);
        setShowControls(false);
      }
    }
  };

  const progress = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0;

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex flex-col overflow-hidden transition-colors duration-300",
      settings.theme === 'dark' ? 'dark bg-background' : 
      settings.theme === 'sepia' ? 'sepia bg-background' : 'bg-background'
    )}>

      {/* Top Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute top-0 left-0 right-0 z-[100] flex items-center justify-between p-4 bg-background/95 backdrop-blur-md border-b shadow-sm text-foreground"
          >
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" onClick={() => setShowSearch(!showSearch)}>
                <SearchIcon className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowToc(!showToc)}>
                <List className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleAddBookmark}>
                <Bookmark className="h-5 w-5" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings2 className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4" align="end">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Theme</h4>
                      <div className="flex gap-2">
                        <Button 
                          variant={settings.theme === 'light' ? 'default' : 'outline'} 
                          className="flex-1 bg-white text-black hover:bg-gray-100"
                          onClick={() => settings.setTheme('light')}
                        >
                          Light
                        </Button>
                        <Button 
                          variant={settings.theme === 'sepia' ? 'default' : 'outline'} 
                          className="flex-1 bg-[#f4ecd8] text-[#5b4636] hover:bg-[#e8dcc3]"
                          onClick={() => settings.setTheme('sepia')}
                        >
                          Sepia
                        </Button>
                        <Button 
                          variant={settings.theme === 'dark' ? 'default' : 'outline'} 
                          className="flex-1 bg-gray-900 text-white hover:bg-gray-800"
                          onClick={() => settings.setTheme('dark')}
                        >
                          Dark
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium">Font Size</h4>
                        <span className="text-xs text-muted-foreground">{settings.fontSize}px</span>
                      </div>
                      <Slider 
                        min={12} max={32} step={1} 
                        value={[settings.fontSize]} 
                        onValueChange={([val]) => settings.setFontSize(val)}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium">Line Height</h4>
                        <span className="text-xs text-muted-foreground">{settings.lineHeight}</span>
                      </div>
                      <Slider 
                        min={1.2} max={2.5} step={0.1} 
                        value={[settings.lineHeight]} 
                        onValueChange={([val]) => settings.setLineHeight(val)}
                      />
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Font Family</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { name: 'Inter', val: "'Inter', sans-serif" },
                          { name: 'Merriweather', val: "'Merriweather', serif" },
                          { name: 'Lora', val: "'Lora', serif" },
                          { name: 'Atkinson', val: "'Atkinson Hyperlegible', sans-serif" }
                        ].map(font => (
                          <Button
                            key={font.name}
                            variant={settings.fontFamily === font.val ? 'default' : 'outline'}
                            onClick={() => settings.setFontFamily(font.val)}
                            className="text-xs"
                            style={{ fontFamily: font.val }}
                          >
                            {font.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Reading Area - CSS Columns based pagination */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        onClick={handleContentClick}
      >
        <div 
          className="absolute top-0 bottom-0 transition-transform duration-300 ease-out flex"
          style={{ 
            transform: `translateX(-${currentPage * columnWidth}px)`,
            width: `${columnWidth}px` 
          }}
        >
          <div 
            ref={contentRef}
            className="h-full px-6 py-12 md:px-12 md:py-16 column-container text-foreground"
            style={{
              columnWidth: `${columnWidth - (window.innerWidth < 768 ? 48 : 96)}px`, // accounting for padding
              columnGap: `${window.innerWidth < 768 ? 48 : 96}px`,
              height: '100%',
              width: '100%',
            }}
            dangerouslySetInnerHTML={{ __html: book.content }}
          />
        </div>
      </div>

      {/* Bottom Controls / Progress */}
      <AnimatePresence>
        {showControls ? (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 z-[100] p-6 bg-background/95 backdrop-blur-md border-t flex flex-col gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] text-foreground"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{Math.round(progress)}%</span>
              <span>Page {currentPage + 1} of {totalPages}</span>
            </div>
            <Slider 
              value={[currentPage]} 
              min={0} 
              max={totalPages > 0 ? totalPages - 1 : 0} 
              step={1}
              onValueChange={([val]) => goToPage(val)}
              className="my-2"
            />
          </motion.div>
        ) : (
          <div className="absolute bottom-2 w-full text-center text-xs text-muted-foreground/50 pointer-events-none">
            {currentPage + 1} / {totalPages || 1}
          </div>
        )}
      </AnimatePresence>

      {/* TOC Sidebar Overlay */}
      <AnimatePresence>
        {showToc && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 z-30"
              onClick={() => setShowToc(false)}
            />
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-0 bottom-0 left-0 w-80 bg-background z-40 border-r shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-lg">Contents</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowToc(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-1">
                  {book.title && (
                    <div className="font-medium mb-4 text-sm uppercase tracking-wider text-muted-foreground">
                      {book.title}
                    </div>
                  )}
                  {/* Mock TOC if not extracted from FB2 */}
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-left font-normal"
                    onClick={() => goToPage(0)}
                  >
                    Start of Book
                  </Button>

                  {/* Real TOC would go here, we mock it for simplicity if empty */}
                  {book.toc && book.toc.length > 0 ? (
                    book.toc.map((item, i) => (
                      <Button 
                        key={i}
                        variant="ghost" 
                        className="w-full justify-start text-left font-normal"
                        style={{ paddingLeft: `${(item.level * 16) + 16}px` }}
                        onClick={() => {
                          jumpToElement(item.id);
                          setShowToc(false);
                        }}
                      >
                        {item.title}
                      </Button>
                    ))
                  ) : (
                    Array.from({ length: 10 }).map((_, i) => (
                      <Button 
                        key={i}
                        variant="ghost" 
                        className="w-full justify-start text-left font-normal pl-4"
                        onClick={() => goToPage(Math.min(i * 10, totalPages - 1))}
                      >
                        Chapter {i + 1}
                      </Button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Search Sidebar Overlay */}
      <AnimatePresence>
        {showSearch && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 z-30"
              onClick={() => setShowSearch(false)}
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-0 bottom-0 right-0 w-80 sm:w-96 bg-background z-40 border-l shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Search</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowSearch(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Search in book..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    autoFocus
                  />
                  <Button onClick={handleSearch}>
                    <SearchIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                {searchResults.length > 0 ? (
                  <div className="p-4 space-y-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      {searchResults.length} results found
                    </div>
                    {searchResults.map((result, i) => (
                      <div 
                        key={i}
                        className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors text-sm"
                        onClick={() => jumpToElement(result.id)}
                      >
                        <p className="line-clamp-3" dangerouslySetInnerHTML={{
                          __html: result.text.replace(new RegExp(searchQuery, 'gi'), match => `<mark class="bg-primary/20 text-primary font-medium rounded-sm px-1">${match}</mark>`)
                        }} />
                      </div>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                    <SearchIcon className="h-8 w-8 opacity-20" />
                    <p>No results found for "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                    <SearchIcon className="h-8 w-8 opacity-20" />
                    <p>Enter a term to search the entire book</p>
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}