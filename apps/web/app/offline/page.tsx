import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="text-center max-w-md">
        <WifiOff className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">
          Kamu sedang offline
        </h1>
        <p className="text-muted-foreground">
          Koneksi internet kamu terputus. CV kamu tetap aman — semua perubahan
          tersimpan secara lokal. Kembali online untuk lanjut chatting dengan Kak.
        </p>
      </div>
    </div>
  );
}
