import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin } from 'lucide-react';

// Current study barangay: Purisima, Tago, Surigao del Sur.
const STUDY_BARANGAYS = ['Purisima'];

interface BarangaySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

export const BarangaySelect = ({ 
  value, 
  onValueChange, 
  placeholder = 'Select your barangay',
  error 
}: BarangaySelectProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <MapPin className="h-4 w-4" /> Barangay *
      </label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={error ? 'border-destructive' : ''}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {STUDY_BARANGAYS.map((barangay) => (
            <SelectItem key={barangay} value={barangay}>
              {barangay}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

export { STUDY_BARANGAYS };
