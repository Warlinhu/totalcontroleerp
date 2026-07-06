import logoAsset from "@/assets/totalcontrole-logo.png.asset.json";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Se true, mostra apenas o símbolo (imagem quadrada). Se false, é a mesma imagem — o logo já contém o wordmark. */
  compact?: boolean;
  alt?: string;
};

export function BrandLogo({ className, alt = "TotalControle ERP" }: Props) {
  return (
    <img
      src={logoAsset.url}
      alt={alt}
      className={cn("select-none", className)}
      draggable={false}
    />
  );
}
