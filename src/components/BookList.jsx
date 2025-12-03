import React, { useEffect, useState } from 'react';
import { listAudiobooks } from '../services/googleDrive';
import { Folder, Music } from 'lucide-react';

const BookList = ({ onSelectBook }) => {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBooks = async () => {
            try {
                const files = await listAudiobooks();
                setBooks(files || []);
            } catch (error) {
                console.error("Failed to list books", error);
            } finally {
                setLoading(false);
            }
        };
        fetchBooks();
    }, []);

    if (loading) {
        return <div className="text-center text-gray-400 mt-10">Casting Revelio... (Loading books)</div>;
    }

    if (books.length === 0) {
        return (
            <div className="text-center text-gray-400 mt-10 p-4">
                <p>No "Harry Potter" folders found in your Drive.</p>
                <p className="text-sm mt-2">Make sure you have a folder named "Harry Potter" with your audiobooks.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {books.map((book) => (
                <div
                    key={book.id}
                    onClick={() => onSelectBook(book)}
                    className="bg-gray-800 p-6 rounded-xl cursor-pointer hover:bg-gray-700 transition-colors border border-gray-700 flex items-center gap-4"
                >
                    <div className="bg-yellow-500/10 p-3 rounded-full text-yellow-500">
                        <Folder size={24} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg text-white">{book.name}</h3>
                        <p className="text-xs text-gray-400">Click to open</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default BookList;
