import QRCode from "qrcode";

export async function QrCodeSvg({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
    color: {
      dark: "#171428",
      light: "#fffdf8",
    },
  });

  return (
    <figure className="grid gap-3">
      <div
        className="overflow-hidden rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-3"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {label ? (
        <figcaption className="break-all text-center font-mono text-xs font-bold text-[#746b80]">
          {label}
        </figcaption>
      ) : null}
    </figure>
  );
}
