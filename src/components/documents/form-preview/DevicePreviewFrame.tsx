'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Monitor, Tablet, Smartphone, RotateCw, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============================================================================
// DEVICE PRESETS
// ============================================================================

export interface DevicePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  icon: React.ElementType;
  category: 'phone' | 'tablet' | 'desktop';
}

export const DEVICE_PRESETS: DevicePreset[] = [
  // Phones
  { id: 'iphone-se', name: 'iPhone SE', width: 375, height: 667, icon: Smartphone, category: 'phone' },
  { id: 'iphone-14', name: 'iPhone 14', width: 390, height: 844, icon: Smartphone, category: 'phone' },
  { id: 'iphone-14-pro-max', name: 'iPhone 14 Pro Max', width: 430, height: 932, icon: Smartphone, category: 'phone' },
  { id: 'pixel-7', name: 'Pixel 7', width: 412, height: 915, icon: Smartphone, category: 'phone' },
  { id: 'samsung-s21', name: 'Samsung Galaxy S21', width: 360, height: 800, icon: Smartphone, category: 'phone' },
  // Tablets
  { id: 'ipad-mini', name: 'iPad Mini', width: 768, height: 1024, icon: Tablet, category: 'tablet' },
  { id: 'ipad-pro-11', name: 'iPad Pro 11"', width: 834, height: 1194, icon: Tablet, category: 'tablet' },
  { id: 'ipad-pro-12', name: 'iPad Pro 12.9"', width: 1024, height: 1366, icon: Tablet, category: 'tablet' },
  { id: 'surface-pro', name: 'Surface Pro', width: 912, height: 1368, icon: Tablet, category: 'tablet' },
  // Desktops
  { id: 'laptop', name: 'Laptop', width: 1366, height: 768, icon: Monitor, category: 'desktop' },
  { id: 'desktop-hd', name: 'Desktop HD', width: 1920, height: 1080, icon: Monitor, category: 'desktop' },
  { id: 'desktop-4k', name: 'Desktop 4K', width: 2560, height: 1440, icon: Monitor, category: 'desktop' },
];

// ============================================================================
// DEVICE PREVIEW FRAME PROPS
// ============================================================================

interface DevicePreviewFrameProps {
  children: React.ReactNode;
  className?: string;
  initialDevice?: string;
  onDeviceChange?: (device: DevicePreset) => void;
  showControls?: boolean;
}

// ============================================================================
// DEVICE PREVIEW FRAME COMPONENT
// ============================================================================

export function DevicePreviewFrame({
  children,
  className,
  initialDevice = 'iphone-14',
  onDeviceChange,
  showControls = true,
}: DevicePreviewFrameProps) {
  const [selectedDevice, setSelectedDevice] = React.useState<DevicePreset>(
    DEVICE_PRESETS.find((d) => d.id === initialDevice) || DEVICE_PRESETS[0]
  );
  const [isRotated, setIsRotated] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [customZoom, setCustomZoom] = React.useState(100);

  // Calculate dimensions (swap if rotated)
  const displayWidth = isRotated ? selectedDevice.height : selectedDevice.width;
  const displayHeight = isRotated ? selectedDevice.width : selectedDevice.height;

  // Calculate zoom to fit in viewport
  const calculateZoom = React.useCallback(() => {
    if (isFullscreen) {
      const viewportWidth = window.innerWidth - 80;
      const viewportHeight = window.innerHeight - 150;
      const zoomW = (viewportWidth / displayWidth) * 100;
      const zoomH = (viewportHeight / displayHeight) * 100;
      return Math.min(zoomW, zoomH, 100);
    }
    return customZoom;
  }, [isFullscreen, displayWidth, displayHeight, customZoom]);

  const zoom = calculateZoom();

  const handleDeviceSelect = (device: DevicePreset) => {
    setSelectedDevice(device);
    onDeviceChange?.(device);
  };

  const handleRotate = () => {
    setIsRotated((prev) => !prev);
  };

  const handleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Get device frame styling
  const getFrameStyle = () => {
    const baseClasses = 'bg-white rounded-[40px] shadow-2xl overflow-hidden relative';
    
    if (selectedDevice.category === 'phone') {
      return cn(baseClasses, 'border-[12px] border-gray-900');
    } else if (selectedDevice.category === 'tablet') {
      return cn(baseClasses, 'border-[14px] border-gray-900');
    } else {
      return cn(baseClasses, 'border-[8px] border-gray-800 rounded-lg');
    }
  };

  // Get notch/dynamic island for phones
  const renderNotch = () => {
    if (selectedDevice.category !== 'phone') return null;
    
    if (selectedDevice.id.includes('14-pro')) {
      // Dynamic Island
      return (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-8 bg-black rounded-b-2xl z-10" />
      );
    }
    // Standard notch
    return (
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-2xl z-10" />
    );
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Controls */}
      {showControls && (
        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            {/* Device Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <selectedDevice.icon className="h-4 w-4" />
                  {selectedDevice.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {/* Phones */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Phones
                </div>
                {DEVICE_PRESETS.filter((d) => d.category === 'phone').map((device) => (
                  <DropdownMenuItem
                    key={device.id}
                    onClick={() => handleDeviceSelect(device)}
                    className={cn(device.id === selectedDevice.id && 'bg-accent')}
                  >
                    <device.icon className="h-4 w-4 mr-2" />
                    {device.name}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {device.width}×{device.height}
                    </span>
                  </DropdownMenuItem>
                ))}
                
                {/* Tablets */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                  Tablets
                </div>
                {DEVICE_PRESETS.filter((d) => d.category === 'tablet').map((device) => (
                  <DropdownMenuItem
                    key={device.id}
                    onClick={() => handleDeviceSelect(device)}
                    className={cn(device.id === selectedDevice.id && 'bg-accent')}
                  >
                    <device.icon className="h-4 w-4 mr-2" />
                    {device.name}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {device.width}×{device.height}
                    </span>
                  </DropdownMenuItem>
                ))}
                
                {/* Desktops */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                  Desktops
                </div>
                {DEVICE_PRESETS.filter((d) => d.category === 'desktop').map((device) => (
                  <DropdownMenuItem
                    key={device.id}
                    onClick={() => handleDeviceSelect(device)}
                    className={cn(device.id === selectedDevice.id && 'bg-accent')}
                  >
                    <device.icon className="h-4 w-4 mr-2" />
                    {device.name}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {device.width}×{device.height}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Dimensions display */}
            <div className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
              {displayWidth} × {displayHeight}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Zoom control */}
            <div className="flex items-center gap-1 mr-2">
              <span className="text-xs text-muted-foreground">Zoom:</span>
              <select
                value={customZoom}
                onChange={(e) => setCustomZoom(Number(e.target.value))}
                className="text-xs border rounded px-1 py-0.5 bg-background"
                disabled={isFullscreen}
              >
                <option value={50}>50%</option>
                <option value={75}>75%</option>
                <option value={100}>100%</option>
                <option value={125}>125%</option>
                <option value={150}>150%</option>
              </select>
            </div>

            {/* Rotate button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRotate}
                    className={cn(isRotated && 'bg-accent')}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rotate Device</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Fullscreen button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleFullscreen}>
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}

      {/* Preview Area */}
      <div
        className={cn(
          'flex-1 overflow-auto bg-gradient-to-br from-gray-100 to-gray-200 p-8',
          isFullscreen && 'fixed inset-0 z-50 p-4'
        )}
      >
        <div
          className="mx-auto transition-all duration-300"
          style={{
            width: displayWidth,
            height: displayHeight,
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          {/* Device Frame */}
          <div className={getFrameStyle()} style={{ width: '100%', height: '100%' }}>
            {/* Notch for phones */}
            {renderNotch()}

            {/* Screen content */}
            <div className="w-full h-full overflow-auto bg-white">
              {children}
            </div>

            {/* Home indicator for phones */}
            {selectedDevice.category === 'phone' && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-900 rounded-full" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DevicePreviewFrame;
