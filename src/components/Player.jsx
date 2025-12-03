import React, { useEffect, useState, useRef, useCallback } from 'react';
import { listChapters, saveProgress, loadProgress, getAccessToken } from '../services/googleDrive';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw, Volume2, List } from 'lucide-react';

const Player = ({ book, onBack }) => {
    const [chapters, setChapters] = useState([]);
    const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
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

    // Save progress function
    const handleSave = useCallback(async () => {
        if (chapters.length === 0) return;

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
            console.log("Progress saved:", audioRef.current.currentTime);
        } catch (e) {
            console.error("Save failed", e);
        }
    }, [book.id, currentChapterIndex, chapters.length]);

    // Handle Chapter Change & Audio Source
    useEffect(() => {
        if (chapters.length > 0) {
            const chapter = chapters[currentChapterIndex];
            const accessToken = getAccessToken();

            if (accessToken) {
                console.log("Loading audio:", chapter.name);

                const loadAudio = async () => {
                    try {
                        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${chapter.id}?alt=media`, {
                            headers: { 'Authorization': `Bearer ${accessToken}` }
                        });

                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);

                        console.log("Audio blob created successfully");

                        const wasPlaying = isPlaying;
                        audioRef.current.src = blobUrl;

                        // Setup audio event listeners
                        audioRef.current.onloadedmetadata = () => {
                            setDuration(audioRef.current.duration);
                        };

                        audioRef.current.ontimeupdate = () => {
                            setCurrentTime(audioRef.current.currentTime);
                        };

                        audioRef.current.onended = () => {
                            // Auto-advance to next chapter
                            if (currentChapterIndex < chapters.length - 1) {
                                setCurrentChapterIndex(prev => prev + 1);
                            } else {
                                setIsPlaying(false);
                            }
                        };

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

    // Auto-save progress every 10s when playing
    useEffect(() => {
        if (isPlaying) {
            progressInterval.current = setInterval(handleSave, 10000);
        } else {
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
            }
        }

        return () => {
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
            }
        };
    }, [isPlaying, handleSave]);

    // Auto-save on pause
    useEffect(() => {
        if (!isPlaying && chapters.length > 0 && audioRef.current.currentTime > 0) {
            handleSave();
        }
    }, [isPlaying, handleSave, chapters.length]);

    // Update volume
    useEffect(() => {
        audioRef.current.volume = volume;
    }, [volume]);

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
            setIsPlaying(true);
        }
    };

    const prevChapter = () => {
        if (currentChapterIndex > 0) {
            setCurrentChapterIndex(prev => prev - 1);
            setIsPlaying(true);
        }
    };

    const skip = (seconds) => {
        const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const seekTo = (percentage) => {
        const newTime = (percentage / 100) * duration;
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) return <div className="text-white text-center mt-10">Loading chapters...</div>;

    const currentChapter = chapters[currentChapterIndex];
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex flex-col h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-800/50 flex items-center gap-4 bg-black/20 backdrop-blur-sm">
                <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
                    <List size={24} />
                </button>
                <h2 className="font-bold truncate text-lg">{book.name}</h2>
            </div>

            {/* Main Content - Chapter List */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {chapters.length === 0 && (
                    <div className="text-gray-400 text-center mt-10">
                        <p>No audio files found in this folder.</p>
                        <p className="text-sm mt-2">Folder ID: {book.id}</p>
                    </div>
                )}
                {chapters.map((chapter, index) => (
                    <div
                        key={chapter.id}
                        onClick={() => {
                            setCurrentChapterIndex(index);
                            setIsPlaying(true);
                        }}
                        className={`p-4 rounded-xl cursor-pointer mb-2 flex items-center justify-between transition-all ${index === currentChapterIndex
                                ? 'bg-gradient-to-r from-green-600/30 to-green-500/20 text-green-400 border border-green-600/50 shadow-lg shadow-green-900/20'
                                : 'hover:bg-gray-800/50 text-gray-300 hover:text-white'
                            }`}
                    >
                        <span className="truncate font-medium">{chapter.name}</span>
                        {index === currentChapterIndex && isPlaying && (
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse" />
                                <div className="w-1 h-3 bg-green-400 rounded-full animate-pulse delay-75" />
                                <div className="w-1 h-5 bg-green-400 rounded-full animate-pulse delay-150" />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Player Controls - Spotify Style */}
            <div className="bg-gradient-to-t from-black via-gray-900 to-gray-900/95 border-t border-gray-800/50 backdrop-blur-xl">
                {/* Progress Bar */}
                <div className="px-6 pt-4">
                    <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
                        <span className="font-mono w-12 text-right">{formatTime(currentTime)}</span>
                        <div
                            className="flex-1 h-1 bg-gray-700 rounded-full cursor-pointer group relative"
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const percentage = ((e.clientX - rect.left) / rect.width) * 100;
                                seekTo(percentage);
                            }}
                        >
                            <div
                                className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full relative transition-all group-hover:h-1.5"
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                        <span className="font-mono w-12">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Current Track Info */}
                <div className="px-6 pb-3">
                    <h3 className="font-bold text-base truncate">{currentChapter?.name || "Select a chapter"}</h3>
                    <p className="text-sm text-gray-400">{book.name}</p>
                </div>

                {/* Playback Controls */}
                <div className="px-6 pb-6 flex items-center justify-center gap-4">
                    {/* Previous Chapter */}
                    <button
                        onClick={prevChapter}
                        disabled={currentChapterIndex === 0}
                        className="text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <SkipBack size={28} fill="currentColor" />
                    </button>

                    {/* Rewind 10s */}
                    <button
                        onClick={() => skip(-10)}
                        className="text-gray-400 hover:text-white transition-colors hover:scale-110 transform"
                    >
                        <RotateCcw size={24} />
                    </button>

                    {/* Play/Pause */}
                    <button
                        onClick={togglePlay}
                        className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transform transition-all shadow-xl hover:shadow-2xl"
                    >
                        {isPlaying ? (
                            <Pause size={28} fill="currentColor" />
                        ) : (
                            <Play size={28} fill="currentColor" className="ml-1" />
                        )}
                    </button>

                    {/* Forward 30s */}
                    <button
                        onClick={() => skip(30)}
                        className="text-gray-400 hover:text-white transition-colors hover:scale-110 transform"
                    >
                        <RotateCw size={24} />
                    </button>

                    {/* Next Chapter */}
                    <button
                        onClick={nextChapter}
                        disabled={currentChapterIndex === chapters.length - 1}
                        className="text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <SkipForward size={28} fill="currentColor" />
                    </button>
                </div>

                {/* Volume Control */}
                <div className="px-6 pb-4 flex items-center gap-3">
                    <Volume2 size={20} className="text-gray-400" />
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume * 100}
                        onChange={(e) => setVolume(e.target.value / 100)}
                        className="flex-1 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                     [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                    />
                </div>
            </div>
        </div>
    );
};

export default Player;
