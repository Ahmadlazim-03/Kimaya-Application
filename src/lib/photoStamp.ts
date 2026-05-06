/**
 * Photo Stamping Utility
 * Stamps a base64 photo with date, time, and address watermark
 * similar to attendance verification apps.
 */

interface StampOptions {
  /** Base64 image to stamp */
  photoBase64: string;
  /** Date/time to display */
  dateTime: Date;
  /** Address lines from reverse geocoding */
  addressLines: string[];
  /** Optional: user name to include */
  userName?: string;
}

/**
 * Reverse geocode GPS coordinates to a human-readable address
 * using the free Nominatim (OpenStreetMap) API.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=id`,
      { headers: { "User-Agent": "KimayaManagement/1.0" } }
    );
    const data = await res.json();

    if (!data.address) {
      return [`${lat.toFixed(6)}, ${lng.toFixed(6)}`];
    }

    const addr = data.address;
    const lines: string[] = [];

    // Build address lines similar to the reference image
    const road = addr.road || addr.pedestrian || addr.path || "";
    const houseNumber = addr.house_number || "";
    if (road) {
      lines.push(houseNumber ? `${houseNumber} ${road}` : road);
    }

    const village = addr.village || addr.suburb || addr.neighbourhood || "";
    if (village) lines.push(village);

    const district = addr.county || addr.city_district || "";
    if (district) lines.push(district);

    const city = addr.city || addr.town || addr.municipality || "";
    if (city) lines.push(city);

    const state = addr.state || "";
    if (state) lines.push(state);

    // Fallback: if no lines, use display name
    if (lines.length === 0 && data.display_name) {
      const parts = data.display_name.split(",").map((s: string) => s.trim());
      return parts.slice(0, 5);
    }

    return lines;
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return [`${lat.toFixed(6)}, ${lng.toFixed(6)}`];
  }
}

/**
 * Format date to Indonesian locale string.
 * e.g., "4 Mei 2026 21.59.59"
 */
function formatDateTimeIndo(date: Date): string {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear();
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  return `${d} ${m} ${y} ${hh}.${mm}.${ss}`;
}

/**
 * Stamp a photo with date/time and address watermark.
 * Returns a new base64 image with the watermark applied.
 */
export async function stampPhoto(options: StampOptions): Promise<string> {
  const { photoBase64, dateTime, addressLines, userName } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(photoBase64); // Fallback: return original
          return;
        }

        // Draw original photo
        ctx.drawImage(img, 0, 0);

        // Calculate text sizing based on image dimensions
        const baseFontSize = Math.max(Math.round(img.width / 24), 16);
        const lineHeight = baseFontSize * 1.35;
        const padding = Math.round(img.width / 30);

        // Build all text lines
        const allLines: string[] = [];
        allLines.push(formatDateTimeIndo(dateTime));
        if (userName) allLines.push(userName);
        allLines.push(...addressLines);

        const totalTextHeight = allLines.length * lineHeight + padding * 2;

        // Draw semi-transparent gradient background at bottom
        const gradientStartY = img.height - totalTextHeight - padding;
        const gradient = ctx.createLinearGradient(0, gradientStartY, 0, img.height);
        gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
        gradient.addColorStop(0.3, "rgba(0, 0, 0, 0.4)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0.7)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, gradientStartY, img.width, img.height - gradientStartY);

        // Set text style
        ctx.fillStyle = "#FFD700"; // Gold/yellow color like the reference
        ctx.font = `bold ${baseFontSize}px 'Inter', 'Arial', sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";

        // Draw text shadow for readability
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        // Draw each line from bottom up
        const startY = img.height - padding;
        for (let i = allLines.length - 1; i >= 0; i--) {
          const y = startY - (allLines.length - 1 - i) * lineHeight;
          ctx.fillText(allLines[i], img.width - padding, y);
        }

        // Reset shadow
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        // Convert to base64
        const result = canvas.toDataURL("image/jpeg", 0.85);
        resolve(result);
      } catch (err) {
        console.error("Photo stamp error:", err);
        resolve(photoBase64); // Fallback
      }
    };
    img.onerror = () => {
      console.error("Failed to load image for stamping");
      resolve(photoBase64); // Fallback
    };
    img.src = photoBase64;
  });
}
