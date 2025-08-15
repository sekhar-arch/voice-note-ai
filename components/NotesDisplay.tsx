import React, { useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Notes } from '../types';
import { 
    DownloadIcon, RetryIcon, UsersIcon, CheckCircleIcon, ClipboardListIcon, 
    ChatBubbleLeftRightIcon, BookOpenIcon, LightBulbIcon, DocumentTextIcon, SoundWaveIcon, ArrowLeftIcon 
} from './icons';

const generateFilename = (title: string, extension: string) => {
  const now = new Date();
  // Using local timezone for filename
  const pad = (num: number) => String(num).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const sanitizedTitle = title.replace(/[\s\W_]+/g, '_').replace(/_+$/, '');
  return `${sanitizedTitle}_${timestamp}.${extension}`;
}

const createNoteContent = (notes: Notes): string => {
  let content = `# ${notes.title}\n\n`;
  
  content += `## Final Summary\n${notes.summary}\n\n`;

  if (notes.participants && notes.participants.length > 0) {
    content += `## Participants\n`;
    content += notes.participants.map(p => `- ${p.name}${p.role ? ` (${p.role})` : ''}`).join('\n');
    content += `\n\n`;
  }
  
  if (notes.decisions && notes.decisions.length > 0) {
    content += `## Decisions Made\n`;
    content += notes.decisions.map(d => `- ${d}`).join('\n');
    content += `\n\n`;
  }

  if (notes.actionItems && notes.actionItems.length > 0) {
    content += `## Action Items\n`;
    content += notes.actionItems.map(a => `- [ ] ${a.task} (Assigned to: ${a.assignee})`).join('\n');
    content += `\n\n`;
  }
  
  if (notes.topics && notes.topics.length > 0) {
    content += `## Discussion Topics\n\n`;
    notes.topics.forEach(topic => {
      content += `### Topic: ${topic.topic}\n`;
      if (topic.keyIdeas && topic.keyIdeas.length > 0) {
        content += `#### Key Ideas:\n`;
        content += topic.keyIdeas.map(idea => `  - ${idea}`).join('\n');
        content += `\n`;
      }
      if (topic.quotes && topic.quotes.length > 0) {
        content += `#### Notable Quotes:\n`;
        content += topic.quotes.map(q => `  > ${q}`).join('\n');
        content += `\n`;
      }
      content += `\n`;
    });
  }

  if (notes.definitions && notes.definitions.length > 0) {
    content += `## Key Definitions\n`;
    content += notes.definitions.map(d => `- **${d.term}:** ${d.definition}`).join('\n');
    content += `\n\n`;
  }
  return content.trim();
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const downloadNotesAsText = (notes: Notes) => {
  const content = createNoteContent(notes);
  const filename = generateFilename(notes.title, 'txt');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, filename);
};

interface SectionProps {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ icon, title, children }) => (
    <section>
        <div className="flex items-center gap-3 mb-3">
            {icon}
            <h3 className="text-xl font-semibold text-cyan-400">{title}</h3>
        </div>
        <div className="pl-9">{children}</div>
    </section>
)

export const NotesDisplay: React.FC<{ notes: Notes; onNewNote: () => void; onBackToHistory?: () => void; audioBlob: Blob | null }> = ({ notes, onNewNote, onBackToHistory, audioBlob }) => {
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadAudio = () => {
    if (!audioBlob) return;
    try {
      const filename = generateFilename(notes.title, 'webm');
      triggerDownload(audioBlob, filename);
    } catch (error) {
      console.error("Failed to prepare audio for download:", error);
      alert("Sorry, there was an error downloading the audio file.");
    }
  };

  const downloadNotesAsHtml = () => {
    if (!notesContainerRef.current) {
      console.error("Notes container ref not found");
      return;
    }

    const clonedNode = notesContainerRef.current.cloneNode(true) as HTMLElement;

    // Remove the controls from the cloned node so they don't appear in the file
    const controls = clonedNode.querySelector('.notes-controls');
    controls?.remove();

    // Remove the scroll container class to show all content in the downloaded file
    const contentArea = clonedNode.querySelector('.notes-content-area');
    if (contentArea) {
      contentArea.classList.remove('max-h-[60vh]', 'overflow-y-auto');
    }

    const contentHtml = clonedNode.innerHTML;

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${notes.title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: sans-serif; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #1f2937; }
        ::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #6b7280; }
    </style>
</head>
<body class="bg-gray-900 text-white">
    <main class="w-full max-w-4xl mx-auto p-6 md:p-10">
        ${contentHtml}
    </main>
</body>
</html>`;
    
    const filename = generateFilename(notes.title, 'html');
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    triggerDownload(blob, filename);
  };

  const handleDownloadPdf = async () => {
    if (!notesContainerRef.current || isGeneratingPdf) {
      return;
    }
    setIsGeneratingPdf(true);

    const elementToCapture = notesContainerRef.current;
    const filename = generateFilename(notes.title, 'pdf');
    
    try {
      const canvas = await html2canvas(elementToCapture, {
        scale: 2, // Higher scale for better quality and crisper text
        backgroundColor: '#1f2937', // This is bg-gray-800
        useCORS: true,
        onclone: (doc) => {
          // This hook lets us modify the cloned DOM before rendering to canvas
          // It does not affect the live page.
          const clonedContainer = doc.body.firstChild as (HTMLElement | null);
          if (!clonedContainer) return;
          
          // Add padding to the cloned container to create a margin in the PDF
          clonedContainer.style.padding = '2rem';
          clonedContainer.style.boxSizing = 'border-box'; // Ensure padding is included in width

          // Remove the controls so they don't appear in the PDF
          const controls = clonedContainer.querySelector('.notes-controls');
          controls?.remove();

          // Expand the scrollable area to capture all content
          const contentArea = clonedContainer.querySelector('.notes-content-area');
          if (contentArea) {
            const el = contentArea as HTMLElement;
            el.style.maxHeight = 'none';
            el.style.overflowY = 'visible';
            el.style.paddingRight = '0'; // Original padding is for scrollbar, not needed
            el.style.marginRight = '0';  // Fix negative margin which would cause overflow
          }
          
          const title = clonedContainer.querySelector('h2');
          if(title){
            // Ensure title has some space after it, especially after controls are removed
            (title as HTMLElement).style.marginBottom = '1.5rem';
          }
        },
      });

      const imgData = canvas.toDataURL('image/png');

      // Use jsPDF to create the document
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt', // Use points, the standard for PDF documents
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // Calculate the height of the image in the PDF to maintain aspect ratio
      const imgRenderHeight = (canvasHeight * pdfWidth) / canvasWidth;

      let heightLeft = imgRenderHeight;
      let position = 0;

      // Add the first page. The image will be clipped automatically to the page size.
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgRenderHeight);
      heightLeft -= pdfHeight;

      // Add more pages if the content is taller than a single page
      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        // The Y position is negative, effectively "pulling up" the image
        // to show the next vertical slice on the new page.
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgRenderHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(filename);

    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Sorry, there was an error generating the PDF file.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div ref={notesContainerRef} className="w-full text-left animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6">
            <h2 className="text-3xl font-bold text-white mb-4 sm:mb-0 pr-4 flex-1">{notes.title}</h2>
            <div className="notes-controls flex items-center gap-2 flex-wrap flex-shrink-0">
                <button
                    onClick={() => downloadNotesAsText(notes)}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md text-sm"
                    aria-label="Download notes as text file"
                >
                    <DownloadIcon className="w-4 h-4" />
                    TXT
                </button>
                 <button
                    onClick={downloadNotesAsHtml}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md text-sm"
                    aria-label="Download notes as HTML file"
                >
                    <DocumentTextIcon className="w-4 h-4" />
                    HTML
                </button>
                <button
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="flex items-center justify-center gap-2 px-3 py-2 w-20 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md text-sm disabled:bg-gray-500 disabled:cursor-wait"
                    aria-label="Download notes as PDF file"
                >
                    <DocumentTextIcon className="w-4 h-4" />
                    {isGeneratingPdf ? '...' : 'PDF'}
                </button>
                {audioBlob && (
                    <button
                        onClick={handleDownloadAudio}
                        className="flex items-center justify-center gap-2 px-3 py-2 w-36 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md text-sm"
                        aria-label="Download recorded audio as WebM"
                    >
                        <SoundWaveIcon className="w-4 h-4" />
                        Audio (WebM)
                    </button>
                )}
                {onBackToHistory ? (
                    <button
                        onClick={onBackToHistory}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md"
                        aria-label="Back to history"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                        History
                    </button>
                ) : (
                    <button
                        onClick={onNewNote}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md"
                        aria-label="Create a new note"
                    >
                        <RetryIcon className="w-5 h-5" />
                        New Note
                    </button>
                )}
            </div>
        </div>
      
      <div className="notes-content-area space-y-8 max-h-[60vh] overflow-y-auto pr-4 -mr-4">
        <Section icon={<LightBulbIcon className="w-6 h-6 text-cyan-400"/>} title="Final Summary">
            <p className="text-gray-300 leading-relaxed">{notes.summary}</p>
        </Section>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {notes.participants?.length > 0 && (
                <Section icon={<UsersIcon className="w-6 h-6 text-cyan-400"/>} title="Participants">
                    <ul className="space-y-2 text-gray-300">
                        {notes.participants.map((p, i) => <li key={i} className="flex items-center gap-2">
                            <span className="font-medium text-gray-200">{p.name}</span> 
                            {p.role && <span className="text-sm text-gray-400 italic">- {p.role}</span>}
                        </li>)}
                    </ul>
                </Section>
            )}

            {notes.decisions?.length > 0 && (
                <Section icon={<CheckCircleIcon className="w-6 h-6 text-cyan-400"/>} title="Decisions Made">
                    <ul className="space-y-2 list-disc list-inside text-gray-300">
                        {notes.decisions.map((d, i) => <li key={i} className="leading-relaxed">{d}</li>)}
                    </ul>
                </Section>
            )}
        </div>
        
        {notes.actionItems?.length > 0 && (
            <Section icon={<ClipboardListIcon className="w-6 h-6 text-cyan-400"/>} title="Action Items">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b border-gray-600">
                            <tr>
                                <th className="p-2 text-gray-300 font-semibold">Task</th>
                                <th className="p-2 text-gray-300 font-semibold">Assigned To</th>
                            </tr>
                        </thead>
                        <tbody>
                            {notes.actionItems.map((item, i) => (
                                <tr key={i} className="border-b border-gray-700">
                                    <td className="p-2 text-gray-300">{item.task}</td>
                                    <td className="p-2 text-gray-400">{item.assignee}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>
        )}

        {notes.topics?.length > 0 && (
            <Section icon={<ChatBubbleLeftRightIcon className="w-6 h-6 text-cyan-400"/>} title="Discussion Topics">
                <div className="space-y-6">
                    {notes.topics.map((topic, i) => (
                        <div key={i} className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                            <h4 className="font-semibold text-lg text-gray-200 mb-2">{topic.topic}</h4>
                            {topic.keyIdeas?.length > 0 && (
                                <>
                                    <h5 className="font-medium text-gray-400 mb-1">Key Ideas:</h5>
                                    <ul className="space-y-1.5 list-disc list-inside text-gray-300 pl-2">
                                        {topic.keyIdeas.map((idea, j) => <li key={j}>{idea}</li>)}
                                    </ul>
                                </>
                            )}
                             {topic.quotes?.length > 0 && (
                                <div className="mt-3">
                                    <h5 className="font-medium text-gray-400 mb-1">Notable Quotes:</h5>
                                    <blockquote className="space-y-2">
                                        {topic.quotes.map((q, j) => <p key={j} className="border-l-4 border-cyan-500 pl-3 italic text-gray-400">{q}</p>)}
                                    </blockquote>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </Section>
        )}

        {notes.definitions?.length > 0 && (
            <Section icon={<BookOpenIcon className="w-6 h-6 text-cyan-400"/>} title="Key Definitions">
                <ul className="space-y-3 text-gray-300">
                    {notes.definitions.map((def, i) => (
                        <li key={i}>
                            <span className="font-semibold text-gray-200">{def.term}:</span> {def.definition}
                        </li>
                    ))}
                </ul>
            </Section>
        )}
      </div>
    </div>
  );
};