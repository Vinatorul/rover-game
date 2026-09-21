import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { viewLink } from '@/lib/client';

export function RoomQr({ code }: { code: string }) {
  const url = viewLink('player', code);
  const [image, setImage] = useState('');
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(url, { width: 640, margin: 4, errorCorrectionLevel: 'M' })
      .then((value) => {
        if (active) setImage(value);
      })
      .catch(() => {
        if (active) setImage('');
      });
    return () => {
      active = false;
    };
  }, [url]);
  return (
    <a className="room-qr" href={url} target="_blank" rel="noreferrer" aria-label={`Войти в комнату ${code}`}>
      {image && <img src={image} alt="QR-код для входа в игру" width={280} height={280} />}
      <span className="screen-code" aria-label={`Код комнаты ${code}`}>
        {code}
      </span>
    </a>
  );
}
