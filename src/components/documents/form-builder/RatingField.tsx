'use client';

import * as React from 'react';
import { Star, Heart, Smile, Frown, Meh, Icon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormField } from '@/lib/types/form-schema';

// ============================================================================
// RATING FIELD - RENDERER (for form display)
// ============================================================================

interface RatingFieldProps {
  field: FormField;
  value?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  error?: string;
}

export function RatingField({ 
  field, 
  value = 0, 
  onChange, 
  disabled = false,
  error 
}: RatingFieldProps) {
  const maxRating = field.ratingMax || 5;
  const style = field.ratingStyle || 'stars';
  const [hoveredValue, setHoveredValue] = React.useState<number | null>(null);
  
  const displayValue = hoveredValue ?? value;
  
  const getIcon = (index: number): React.ReactNode => {
    const filled = index <= displayValue;
    const iconClass = cn(
      'w-8 h-8 transition-all cursor-pointer',
      filled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300',
      disabled && 'cursor-not-allowed opacity-50'
    );
    
    switch (style) {
      case 'stars':
        return <Star className={iconClass} />;
      case 'hearts':
        return <Heart className={cn(iconClass, filled && 'text-red-500 fill-red-500')} />;
      case 'emojis':
        if (index <= maxRating / 3) {
          return <Frown className={cn(iconClass, filled ? 'text-red-400' : '')} />;
        } else if (index <= (maxRating * 2) / 3) {
          return <Meh className={cn(iconClass, filled ? 'text-yellow-400' : '')} />;
        } else {
          return <Smile className={cn(iconClass, filled ? 'text-green-400' : '')} />;
        }
      case 'numbers':
        return (
          <span className={cn(
            'w-8 h-8 flex items-center justify-center rounded-full border-2 transition-all cursor-pointer text-sm font-medium',
            filled ? 'bg-primary border-primary text-primary-foreground' : 'border-gray-300 text-gray-500',
            disabled && 'cursor-not-allowed opacity-50'
          )}>
            {index}
          </span>
        );
      default:
        return <Star className={iconClass} />;
    }
  };
  
  const handleClick = (index: number) => {
    if (!disabled && onChange) {
      onChange(index === value ? 0 : index);
    }
  };
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      
      <div className="flex items-center gap-1">
        {Array.from({ length: maxRating }, (_, i) => i + 1).map((index) => (
          <button
            key={index}
            type="button"
            onClick={() => handleClick(index)}
            onMouseEnter={() => setHoveredValue(index)}
            onMouseLeave={() => setHoveredValue(null)}
            disabled={disabled}
            className="p-0 bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
            aria-label={`Rate ${index} out of ${maxRating}`}
          >
            {getIcon(index)}
          </button>
        ))}
      </div>
      
      {/* Endpoint labels */}
      {field.ratingLabels && (
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{field.ratingLabels.low}</span>
          <span>{field.ratingLabels.high}</span>
        </div>
      )}
      
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

// ============================================================================
// RATING FIELD - BUILDER (for form builder configuration)
// ============================================================================

interface RatingFieldBuilderProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function RatingFieldBuilder({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: RatingFieldBuilderProps) {
  const maxRating = field.ratingMax || 5;
  const style = field.ratingStyle || 'stars';
  
  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative p-4 rounded-lg border-2 transition-all cursor-pointer group',
        isSelected 
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
          : 'border-border hover:border-primary/50'
      )}
    >
      {/* Drag handle indicator */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>
      
      {/* Field content */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {field.label || 'Rating'}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Rating
          </span>
        </div>
        
        {/* Preview stars */}
        <div className="flex items-center gap-1">
          {Array.from({ length: maxRating }, (_, i) => i + 1).map((index) => (
            <Star
              key={index}
              className="w-6 h-6 text-gray-300"
            />
          ))}
        </div>
        
        {field.ratingLabels && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{field.ratingLabels.low}</span>
            <span>{field.ratingLabels.high}</span>
          </div>
        )}
        
        {field.helpText && (
          <p className="text-xs text-muted-foreground">{field.helpText}</p>
        )}
      </div>
      
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default RatingField;
