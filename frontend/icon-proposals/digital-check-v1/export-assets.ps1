# Esporta la proposta separata con System.Drawing, senza dipendenze aggiuntive.
Add-Type -AssemblyName System.Drawing
$proposalRoot = $PSScriptRoot
function Round-Rect([single]$x,[single]$y,[single]$w,[single]$h,[single]$r) {
 $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
 $d = 2*$r
 $path.AddArc($x,$y,$d,$d,180,90); $path.AddArc(($x+$w-$d),$y,$d,$d,270,90)
 $path.AddArc(($x+$w-$d),($y+$h-$d),$d,$d,0,90); $path.AddArc($x,($y+$h-$d),$d,$d,90,90)
 $path.CloseFigure(); return ,$path
}
function Export-Proposal([int]$size,[string]$name,[bool]$maskable=$false) {
 $bitmap = [System.Drawing.Bitmap]::new($size,$size)
 $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
 $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
 $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
 $blue = [System.Drawing.ColorTranslator]::FromHtml('#2563eb')
 if ($maskable) { $graphics.Clear($blue); $scale = .78*$size/512; $offset = 56*$size/512 } else { $graphics.Clear([System.Drawing.Color]::Transparent); $scale = $size/512; $offset=0 }
 $matrix = [System.Drawing.Drawing2D.Matrix]::new([single]$scale,0,0,[single]$scale,[single]$offset,[single]$offset)
 $graphics.Transform = $matrix
 $brush = [System.Drawing.SolidBrush]::new($blue)
 $shape=Round-Rect 0 0 512 512 112; $graphics.FillPath($brush,$shape); $shape.Dispose()
 $brush.Color=[System.Drawing.ColorTranslator]::FromHtml('#0f172a')
 $shape=Round-Rect 80 100 352 206 32; $graphics.FillPath($brush,$shape); $shape.Dispose()
 $pen=[System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#ecfeff'),12)
 $pen.StartCap=[System.Drawing.Drawing2D.LineCap]::Round; $pen.EndCap=[System.Drawing.Drawing2D.LineCap]::Round
 $segments=@{a=@(6,0,38,0);b=@(44,6,44,46);c=@(44,58,44,98);d=@(6,104,38,104);e=@(0,58,0,98);f=@(0,6,0,46);g=@(6,52,38,52)}
 foreach($digit in @(@(114,'0'),@(178,'9'),@(274,'0'),@(338,'0'))) {
  $x=[single]$digit[0]; $letters=if($digit[1] -eq '0'){'abcdef'}else{'abcdfg'}
  foreach($letter in $letters.ToCharArray()) { $line=$segments[[string]$letter]; $graphics.DrawLine($pen,[single]($x+$line[0]),[single](144+$line[1]),[single]($x+$line[2]),[single](144+$line[3])) }
 }
 $brush.Color=[System.Drawing.ColorTranslator]::FromHtml('#a5f3fc'); $graphics.FillEllipse($brush,240,169,14,14); $graphics.FillEllipse($brush,240,211,14,14)
 $brush.Color=[System.Drawing.Color]::FromArgb(178,255,255,255); $shape=Round-Rect 112 354 128 18 9; $graphics.FillPath($brush,$shape); $shape.Dispose()
 $brush.Color=[System.Drawing.ColorTranslator]::FromHtml('#10b981'); $graphics.FillEllipse($brush,294,298,144,144)
 $pen.Color=[System.Drawing.Color]::White; $pen.Width=24; $pen.LineJoin=[System.Drawing.Drawing2D.LineJoin]::Round
 $points=[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(332,370),[System.Drawing.PointF]::new(355,393),[System.Drawing.PointF]::new(400,345)); $graphics.DrawLines($pen,$points)
 $bitmap.Save((Join-Path $proposalRoot $name),[System.Drawing.Imaging.ImageFormat]::Png)
 $pen.Dispose();$brush.Dispose();$matrix.Dispose();$graphics.Dispose();$bitmap.Dispose()
}
foreach($size in @(16,32,48,64,180,192,512)) { Export-Proposal $size "office-clocking-$size.png" }
Export-Proposal 512 'office-clocking-maskable-512.png' $true
# ICO contenente frame PNG standard a 16/32/48/64px.
$stream=[System.IO.File]::Create((Join-Path $proposalRoot 'favicon-proposal.ico'))
$writer=[System.IO.BinaryWriter]::new($stream)
$sizes=@(16,32,48,64);$writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$sizes.Count)
$offset=6+16*$sizes.Count; $images=@()
foreach($size in $sizes) {
 $bytes=[System.IO.File]::ReadAllBytes((Join-Path $proposalRoot "office-clocking-$size.png"));$images+=,@($bytes)
 $writer.Write([byte]$size);$writer.Write([byte]$size);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$bytes.Length);$writer.Write([uint32]$offset);$offset+=$bytes.Length
}
foreach($bytes in $images) { $writer.Write([byte[]]$bytes) };$writer.Dispose();$stream.Dispose()
Write-Output 'Asset proposta esportati; nessun file favicon/PWA attivo sostituito.'
