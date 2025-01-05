import { useEffect, useRef, memo } from 'react';

interface CellFormatMenuProps {
    position: { x: number; y: number } | null;
    isVisible: boolean;
    onClose: () => void;
    isBold: boolean;
    isItalic: boolean;
    onToggleBold: () => void;
    onToggleItalic: () => void;
}

const CellFormatMenu = memo(function CellFormatMenu({ 
    position, 
    isVisible, 
    onClose,
    isBold,
    isItalic,
    onToggleBold,
    onToggleItalic 
}: CellFormatMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        }

        if (isVisible) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isVisible, onClose]);

    if (!isVisible || !position) return null;

    return (
        <div
            ref={menuRef}
            className="absolute z-50 bg-white shadow-lg rounded-md border border-gray-200 p-1 flex gap-1"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: 'translate(8px, -50%)'
            }}
        >
            <button
                onClick={onToggleBold}
                className={`w-6 h-6 rounded hover:bg-gray-100 ${isBold ? 'bg-gray-200' : ''}`}
                title="Bold"
            >
                <span className="font-bold">B</span>
            </button>
            <button
                onClick={onToggleItalic}
                className={`w-6 h-6 rounded hover:bg-gray-100 ${isItalic ? 'bg-gray-200' : ''}`}
                title="Italic"
            >
                <span className="italic font-serif">I</span>
            </button>
        </div>
    );
});

export default CellFormatMenu; 