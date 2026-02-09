import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Cloud, 
  CloudRain, 
  CloudLightning, 
  Sun,
  Wind,
  Droplets,
  Thermometer,
  X,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface WeatherData {
  location: string;
  advisory: string;
  temperature: string;
  condition: string;
  humidity: string;
  windSpeed: string;
  rainfall: string;
  lastUpdated: string;
  source: string;
}

const conditionIcons: Record<string, React.ElementType> = {
  'Clear Sky': Sun,
  'Mainly Clear': Sun,
  'Partly Cloudy': Cloud,
  'Cloudy': Cloud,
  'Overcast': Cloud,
  'Rainy': CloudRain,
  'Slight Rain': CloudRain,
  'Moderate Rain': CloudRain,
  'Heavy Rain': CloudRain,
  'Thunderstorms': CloudLightning,
  'Thunderstorm': CloudLightning,
};

interface WeatherAdvisoryProps {
  onDismiss?: () => void;
}

export const WeatherAdvisory = ({ onDismiss }: WeatherAdvisoryProps) => {
  const { data: weather, isLoading, error, refetch, isFetching } = useQuery<WeatherData>({
    queryKey: ['pagasa-weather'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('pagasa-weather');
      if (error) throw error;
      return data;
    },
    refetchInterval: 1000 * 60 * 30, // Refetch every 30 minutes
    staleTime: 1000 * 60 * 15, // Consider data stale after 15 minutes
  });

  if (isLoading) {
    return (
      <Card className="mx-4 mt-4 border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="animate-pulse h-10 w-10 bg-primary/20 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="animate-pulse h-4 w-32 bg-primary/20 rounded" />
              <div className="animate-pulse h-3 w-48 bg-primary/10 rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return null;
  }

  const WeatherIcon = conditionIcons[weather.condition] || Cloud;
  const hasWarning = weather.advisory.includes('⚠️') || 
                     weather.advisory.toLowerCase().includes('warning') ||
                     weather.advisory.toLowerCase().includes('thunderstorm');

  return (
    <Card className={cn(
      "mx-4 mt-4 border overflow-hidden transition-all",
      hasWarning 
        ? "border-warning/50 bg-gradient-to-r from-warning/15 to-warning/5" 
        : "border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {hasWarning ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <WeatherIcon className="h-5 w-5 text-primary" />
            )}
            <div>
              <h3 className="font-semibold text-sm">Weather Advisory</h3>
              <p className="text-xs text-muted-foreground">{weather.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            {onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Advisory Message */}
        <p className={cn(
          "text-sm mb-3 p-2 rounded-lg",
          hasWarning ? "bg-warning/10 text-warning-foreground" : "bg-primary/10"
        )}>
          {weather.advisory}
        </p>

        {/* Weather Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-background/50 rounded-lg p-2">
            <Thermometer className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs font-medium">{weather.temperature}</p>
            <p className="text-[10px] text-muted-foreground">Temp</p>
          </div>
          <div className="bg-background/50 rounded-lg p-2">
            <Droplets className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs font-medium">{weather.humidity}</p>
            <p className="text-[10px] text-muted-foreground">Humidity</p>
          </div>
          <div className="bg-background/50 rounded-lg p-2">
            <Wind className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs font-medium">{weather.windSpeed}</p>
            <p className="text-[10px] text-muted-foreground">Wind</p>
          </div>
          <div className="bg-background/50 rounded-lg p-2">
            <WeatherIcon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs font-medium truncate">{weather.condition}</p>
            <p className="text-[10px] text-muted-foreground">Condition</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
          <Badge variant="outline" className="text-[10px]">
            {weather.source}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            Updated: {format(new Date(weather.lastUpdated), 'h:mm a')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
