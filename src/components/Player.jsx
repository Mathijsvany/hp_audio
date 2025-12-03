import React, { useEffect, useState, useRef } from 'react';
import { listChapters, saveProgress, loadProgress, getAccessToken } from '../services/googleDrive';
import { Play, Pause, SkipBack, SkipForward, List } from 'lucide-react';

const Player = ({ book, onBack }) => {
    const [chapters, setChapters] = useState([]);
    const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef(new Audio());
    const progressInterval = useRef(null);

    // Load chapters and progress
    useEffect(() => {
        const init = async () => {
            try {
                const [files, savedProgress] = await Promise.all([
                    listChapters(book.id),
                    loadProgress()
                ]);

                const sorted = (files || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                setChapters(sorted);

                // Restore progress if exists for this book
                if (savedProgress[book.id]) {
                    const { chapterIndex, time } = savedProgress[book.id];
                    if (chapterIndex < sorted.length) {
                        setCurrentChapterIndex(chapterIndex);
                        setCurrentTime(time);
                    }
                }
            } catch (error) {
                console.error("Failed to load data", error);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [book.id]);

    // Handle Chapter Change & Audio Source
    useEffect(() => {
        if (chapters.length > 0) {
            const chapter = chapters[currentChapterIndex];
            const accessToken = getAccessToken();

            if (accessToken) {
                console.log("Loading audio:", chapter.name);

                // Fetch audio as blob instead of direct streaming
                const loadAudio = async () => {
                    try {
                        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${chapter.id}?alt=media`, {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`
                            }
                        });

                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }

                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);

                        console.log("Audio blob created successfully");

                        const wasPlaying = isPlaying;
                        audioRef.current.src = blobUrl;

                        // Restore time if it's the first load
                        if (currentTime > 0) {
                            audioRef.current.currentTime = currentTime;
                            setCurrentTime(0);
                        }

                        if (wasPlaying) {
                            audioRef.current.play().catch(e => console.error("Play failed", e));
                        }
                    } catch (error) {
                        console.error("Failed to load audio:", error);
                    }
                };

                loadAudio();
            }
        }
    }, [currentChapterIndex, chapters]);

    // Auto-save progress
    useEffect(() => {
        progressInterval.current = setInterval(() => {
            if (isPlaying && chapters.length > 0) {
                handleSave();
            }
        }, 10000); // Save every 10s

        return () => clearInterval(progressInterval.current);
    }, [isPlaying, currentChapterIndex, book.id]);

    const handleSave = async () => {
        try {
            const currentProgress = await loadProgress();
            const newProgress = {
                ...currentProgress,
                [book.id]: {
                    chapterIndex: currentChapterIndex,
                    time: audioRef.current.currentTime,
                    timestamp: Date.now()
                }
            };
            await saveProgress(newProgress);
            console.log("Progress saved");
        } catch (e) {
            console.error("Save failed", e);
        }
    };

    // Auto-save on pause
    useEffect(() => {
        if (!isPlaying && chapters.length > 0) {
            handleSave();
        }
    }, [isPlaying]);


    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().then(() => {
                console.log("Playback started successfully");
            }).catch(e => {
                console.error("Play failed:", e);
            });
        }
        setIsPlaying(!isPlaying);
    };

    const nextChapter = () => {
        if (currentChapterIndex < chapters.length - 1) {
            setCurrentChapterIndex(prev => prev + 1);
        }
    };

    const prevChapter = () => {
        if (currentChapterIndex > 0) {
            setCurrentChapterIndex(prev => prev - 1);
        }
    };

    if (loading) return <div className="text-white text-center mt-10">Loading chapters...</div>;

    const currentChapter = chapters[currentChapterIndex];

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex items-center gap-4">
                <button onClick={onBack} className="text-gray-400 hover:text-white">
                    <List size={24} />
                </button>
                <h2 className="font-bold truncate">{book.name}</h2>
            </div>

            {/* Main Content - Chapter List */}
            <div className="flex-1 overflow-y-auto p-4">
                {chapters.length === 0 && (
                    <div className="text-gray-400 text-center mt-10">
                        <p>No audio files found in this folder.</p>
                        <p className="text-sm mt-2">Folder ID: {book.id}</p>
                    </div>
                )}
                {chapters.map((chapter, index) => (
                    <div
                        key={chapter.id}
                        onClick={() => setCurrentChapterIndex(index)}
                        className={`p-3 rounded-lg cursor-pointer mb-2 flex items-center justify-between ${index === currentChapterIndex ? 'bg-blue-600/20 text-blue-400 border border-blue-600/50' : 'hover:bg-gray-800'
                            }`}
                    >
                        <span className="truncate">{chapter.name}</span>
                        {index === currentChapterIndex && isPlaying && <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />}
                    </div>
                ))}
            </div>

            {/* Player Controls */}
            <div className="bg-gray-800 p-6 border-t border-gray-700">
                <div className="text-center mb-4">
                    <h3 className="font-semibold truncate">{currentChapter?.name || "Select a chapter"}</h3>
                </div>

                <div className="flex items-center justify-center gap-8">
                    <button onClick={prevChapter} className="text-gray-400 hover:text-white">
                        <SkipBack size={32} />
                    </button>

                    <button
                        onClick={togglePlay}
                        className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center text-black hover:bg-yellow-400 transition-transform hover:scale-105"
                    >
                        {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                    </button>

                    <button onClick={nextChapter} className="text-gray-400 hover:text-white">
                        <SkipForward size={32} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Player;
