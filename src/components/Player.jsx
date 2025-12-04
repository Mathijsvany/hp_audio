import React, { useEffect, useState, useRef, useCallback } from 'react';
import { listChapters, saveProgress, loadProgress, getAccessToken } from '../services/googleDrive';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw, Volume2, List, ChevronDown, ChevronUp } from 'lucide-react';

const Player = ({ book, onBack }) => {
    const [chapters, setChapters] = useState([]);
    const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [showChapters, setShowChapters] = useState(false);
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
                if (savedProgress && savedProgress[book.id]) {
                    const { chapterIndex, time } = savedProgress[book.id];
                    console.log("📍 Found saved progress - Chapter:", chapterIndex, "Time:", time);

                    // Validate the saved progress
                    if (chapterIndex < sorted.length && chapterIndex >= 0) {
                        setCurrentChapterIndex(chapterIndex);
                        setCurrentTime(time);
                    } else {
                        console.log("⚠️ Invalid chapter index, resetting to 0");
                        setCurrentChapterIndex(0);
                        setCurrentTime(0);
                    }
                } else {
                    console.log("No saved progress, starting at chapter 0");
                    setCurrentChapterIndex(0);
                    setCurrentTime(0);
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
            console.log("💾 Progress saved - Chapter:", currentChapterIndex, "Time:", audioRef.current.currentTime.toFixed(1));
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
                console.log("🎵 Loading:", chapter.name);

                const loadAudio = async () => {
                    try {
                        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${chapter.id}?alt=media`, {
                            headers: { 'Authorization': `Bearer ${accessToken}` }
                        });

                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);

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
                console.log("▶️  Playback started");
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
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) return <div className="text-white text-center mt-10">Loading...</div>;

    const currentChapter = chapters[currentChapterIndex];
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex flex-col h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-800/50 flex items-center gap-4 bg-black/20 backdrop-blur-sm">
                <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
                    <List size={24} />
                </button>
                <div className="flex-1">
                    <h2 className="font-bold truncate text-lg">{book.name}</h2>
                    <p className="text-xs text-gray-400">
                        Chapter {currentChapterIndex + 1} van {chapters.length}
                    </p>
                </div>
                <button
                    onClick={async () => {
                        if (confirm('Reset progress voor dit boek?')) {
                            const allProgress = await loadProgress();
                            // Overwrite with 0 instead of deleting, so timestamp is newer!
                            allProgress[book.id] = {
                                chapterIndex: 0,
                                time: 0,
                                timestamp: Date.now()
                            };
                            await saveProgress(allProgress);
                            setCurrentChapterIndex(0);
                            setCurrentTime(0);
                            if (audioRef.current) audioRef.current.currentTime = 0;
                            console.log('🔄 Progress reset to chapter 0!');
                            alert('Progress gereset! Ververs de pagina.');
                        }
                    }}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded-lg text-xs text-red-400 transition-colors whitespace-nowrap"
                >
                    Reset
                </button>
            </div>

            {/* Main Content - Simplified View */}
            <div className="flex-1 flex flex-col items-center justify-center p-6">
                {/* Album Art Placeholder */}
                <div className="w-64 h-64 bg-gradient-to-br from-yellow-600 to-yellow-800 rounded-2xl shadow-2xl mb-8 flex items-center justify-center">
                    <div className="text-6xl">📖</div>
                </div>

                {/* Current Chapter */}
                <div className="text-center mb-8 max-w-md">
                    <h3 className="text-2xl font-bold mb-2">{currentChapter?.name || "Loading..."}</h3>
                    <p className="text-sm text-gray-400">{formatTime(currentTime)} / {formatTime(duration)}</p>
                </div>

                {/* Chapter List Toggle */}
                <button
                    onClick={() => setShowChapters(!showChapters)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors mb-4"
                >
                    {showChapters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <span className="text-sm">
                        {showChapters ? 'Verberg chapters' : 'Toon alle chapters'}
                    </span>
                </button>

                {/* Collapsible Chapter List */}
                {showChapters && (
                    <div className="w-full max-w-md max-h-48 overflow-y-auto bg-gray-800/50 rounded-lg p-2 mb-4">
                        {chapters.map((chapter, index) => (
                            <div
                                key={chapter.id}
                                onClick={() => {
                                    setCurrentChapterIndex(index);
                                    setIsPlaying(true);
                                }}
                                className={`p-2 rounded cursor-pointer text-sm mb-1 ${index === currentChapterIndex
                                    ? 'bg-green-600/30 text-green-400'
                                    : 'hover:bg-gray-700 text-gray-300'
                                    }`}
                            >
                                {index + 1}. {chapter.name}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Player Controls - Spotify Style */}
            <div className="bg-gradient-to-t from-black via-gray-900 to-gray-900/95 border-t border-gray-800/50 backdrop-blur-xl">
                {/* Progress Bar */}
                <div className="px-6 pt-4">
                    <div
                        className="h-1.5 bg-gray-700 rounded-full cursor-pointer group relative"
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const percentage = ((e.clientX - rect.left) / rect.width) * 100;
                            seekTo(percentage);
                        }}
                    >
                        <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full relative transition-all"
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg" />
                        </div>
                    </div>
                </div>

                {/* Playback Controls */}
                <div className="px-6 py-6 flex items-center justify-center gap-6">
                    {/* Previous Chapter */}
                    <button
                        onClick={prevChapter}
                        disabled={currentChapterIndex === 0}
                        className="text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                    >
                        <SkipBack size={32} fill="currentColor" />
                    </button>

                    {/* Rewind 10s */}
                    <button
                        onClick={() => skip(-10)}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <RotateCcw size={28} />
                    </button>

                    {/* Play/Pause */}
                    <button
                        onClick={togglePlay}
                        className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transform transition-all shadow-xl"
                    >
                        {isPlaying ? (
                            <Pause size={32} fill="currentColor" />
                        ) : (
                            <Play size={32} fill="currentColor" className="ml-1" />
                        )}
                    </button>

                    {/* Forward 30s */}
                    <button
                        onClick={() => skip(30)}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <RotateCw size={28} />
                    </button>

                    {/* Next Chapter */}
                    <button
                        onClick={nextChapter}
                        disabled={currentChapterIndex === chapters.length - 1}
                        className="text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                    >
                        <SkipForward size={32} fill="currentColor" />
                    </button>
                </div>

                {/* Volume Control */}
                <div className="px-6 pb-4 flex items-center gap-3">
                    <Volume2 size={18} className="text-gray-400" />
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume * 100}
                        onChange={(e) => setVolume(e.target.value / 100)}
                        className="flex-1 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                     [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                    />
                </div>
            </div>
        </div>
    );
};

export default Player;
