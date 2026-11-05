$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'wearable\src\common'
$maneuvers = @('left','right','straight','slight_left','slight_right','sharp_left','sharp_right','uturn','roundabout','arrive','unknown')
$styles = @('line','solid')
# Vela cannot tint images. These IDs match settings.js COLOR_OPTIONS.
$palette = [ordered]@{ white = '#ffffff'; mint = '#80f5be'; amber = '#ffcf6b'; sky = '#7cc7ff' }
$weights = 4..10
$artwork = Get-Content -LiteralPath (Join-Path $assetRoot 'arrow-artwork.json') -Raw | ConvertFrom-Json
$size = [int]$artwork.pngSize
$supersample = 3
# Draw in 80-unit coordinates, then use a tight, square frame per maneuver.
# All colours, styles and weights share that frame, so changing weight cannot
# shrink or shift a symbol. Leave a small antialiasing guard around each outline.
# Each style has its own optical weights, keeping the line chevron open at 10.
$lineWidths = @(7,8,9,10,11,12,13)
$solidWidths = @(9,10.5,12,13.5,15,16.5,18)

function New-ArrowPen($color, $width) {
    $pen = [Drawing.Pen]::new($color, [float]$width)
    $pen.StartCap = [Drawing.Drawing2D.LineCap]::Flat
    $pen.EndCap = [Drawing.Drawing2D.LineCap]::Flat
    $pen.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
    return $pen
}

# Heads are explicit outlines: sharp tips without miter spikes or protruding
# shaft caps. u = cross-route, v = distance behind the tip.
function Draw-Head($g, $brush, $style, $width, $x, $y, $dx, $dy, $headScale) {
    if ($style -eq 'solid') {
        $length = (19 + 0.18 * $width) * $headScale
        $half = (15 + 0.22 * $width) * $headScale
        $local = @(@(0,0), @($half,$length), @(-$half,$length))
    } else {
        $half = (18 + 0.16 * $width) * $headScale
        $length = $half
        $inset = $width / [Math]::Sqrt(2)
        $inner = $half - $inset
        $back = $length + $inset
        $notch = 2 * $inset
        $local = @(@(0,0), @($half,$length), @($inner,$back), @(0,$notch), @(-$inner,$back), @(-$half,$length))
    }
    $points = [Drawing.PointF[]]::new($local.Count)
    for ($i = 0; $i -lt $local.Count; $i++) {
        $u = $local[$i][0]; $v = $local[$i][1]
        $points[$i] = [Drawing.PointF]::new([float]($x - $v*$dx - $u*$dy), [float]($y - $v*$dy + $u*$dx))
    }
    $g.FillPolygon($brush, $points)
}

function Draw-Maneuver($g, $maneuver, $weight, $style, $color) {
    $width = if ($style -eq 'line') { $lineWidths[$weight-4] } else { $solidWidths[$weight-4] }
    $saved = $g.Save()
    $brush = [Drawing.SolidBrush]::new($color)
    $path = [Drawing.Drawing2D.GraphicsPath]::new()
    $pen = New-ArrowPen $color $width
    try {
        if ($maneuver -eq 'roundabout') {
            # Entrance + counter-clockwise circulation. The centre is reserved
            # for a native exit ordinal; this is not a geographic exit angle.
            $ringWidth = if ($style -eq 'line') { 4.5 + 0.5*($weight-4) } else { 6 + 0.5*($weight-4) }
            $pen.Width = [float]$ringWidth
            $guide = New-ArrowPen ([Drawing.Color]::FromArgb(65,$color)) ([Math]::Max(2,$ringWidth*0.38))
            $g.DrawEllipse($guide,18,12,44,44)
            $guide.Dispose()
            $path.AddLine(40,72,40,65)
            $path.AddBezier(40,65,40,58,62,60,62,34)
            # End at the circle's leftmost point, whose tangent points straight
            # down. A short straight neck aligns both head styles to that tangent;
            # trimming a curved arc behind a diagonal head made the old join skew.
            $headScale = if ($style -eq 'line') { 0.78 } else { 0.68 }
            $tipY = 60
            $back = if ($style -eq 'solid') { (19+0.18*$ringWidth)*$headScale-1 } else { $ringWidth*1.2 }
            $path.AddArc(18,12,44,44,0,-180)
            $path.AddLine(18,34,18,[float]($tipY-$back))
            $g.DrawPath($pen,$path)
            Draw-Head $g $brush $style $ringWidth 18 $tipY 0 1 $headScale
            return
        }
        if ($maneuver -eq 'arrive') {
            $pen.Width = [float](4 + ($weight-4)*0.7)
            $g.DrawLine($pen,23,70,23,12)
            $path.AddLine(23,14,63,14)
            $path.AddLine(63,14,55,30)
            $path.AddLine(55,30,63,46)
            $path.AddLine(63,46,23,46)
            $path.CloseFigure()
            if ($style -eq 'solid') { $g.FillPath($brush,$path) } else { $g.DrawPath($pen,$path) }
            return
        }
        if ($maneuver -eq 'unknown') {
            # Question mark rather than an information "i" or a guessed turn.
            $pen.Width = [float](4.5 + ($weight-4)*0.55)
            $g.DrawEllipse($pen,13,13,54,54)
            $pen.Width = [float](5 + ($weight-4)*0.5)
            $path.AddBezier(31,30,31,18,52,19,51,32)
            $path.AddBezier(51,32,50,39,40,38,40,47)
            $g.DrawPath($pen,$path)
            $g.FillRectangle($brush,37,53,6,6)
            return
        }
        $shape = $maneuver
        if ($shape -eq 'uturn' -and $style -eq 'line') {
            $width *= 0.85
            $pen.Width = [float]$width
        }
        if ($maneuver -in @('left','slight_left','sharp_left')) {
            $shape = $maneuver.Replace('left','right')
            $g.TranslateTransform(80,0)
            $g.ScaleTransform(-1,1)
        }
        $headScale = if ($shape -eq 'uturn' -and $style -eq 'solid') { 0.9 } else { 1 }
        $tipX = 40; $tipY = 10; $dx = 0; $dy = -1
        switch ($shape) {
            'right' { $tipX = 69; $tipY = 28; $dx = 1; $dy = 0 }
            'slight_right' { $tipX = 63; $tipY = 12; $dx = 0.707107; $dy = -0.707107 }
            'sharp_right' { $tipX = 63; $tipY = 51; $dx = 0.707107; $dy = 0.707107 }
            'uturn' { $tipX = 24; $tipY = 66; $dx = 0; $dy = 1 }
        }
        $back = if ($style -eq 'solid') { (19+0.18*$width)*$headScale-1 } else { $width*1.2 }
        $endX = [float]($tipX-$back*$dx); $endY = [float]($tipY-$back*$dy)
        switch ($shape) {
            'straight' { $path.AddLine(40,70,$endX,$endY) }
            'right' {
                $path.AddLine(23,70,23,45)
                $path.AddBezier(23,45,23,33,28,28,40,28)
                $path.AddLine(40,28,$endX,$endY)
            }
            'slight_right' {
                $path.AddLine(27,70,27,49)
                $path.AddBezier(27,49,27,45,31,44,36,39)
                $path.AddLine(36,39,$endX,$endY)
            }
            'sharp_right' {
                $path.AddLine(20,70,20,33)
                $path.AddBezier(20,33,20,16,29,16,41,29)
                $path.AddLine(41,29,$endX,$endY)
            }
            'uturn' {
                $path.AddLine(59,70,59,32)
                $path.AddBezier(59,32,59,21,53,14,42,14)
                $path.AddBezier(42,14,31,14,24,21,24,32)
                $path.AddLine(24,32,$endX,$endY)
            }
        }
        $g.DrawPath($pen,$path)
        Draw-Head $g $brush $style $width $tipX $tipY $dx $dy $headScale
    } finally {
        $pen.Dispose(); $path.Dispose(); $brush.Dispose(); $g.Restore($saved)
    }
}

# Replace individual generated assets, never recursively delete the tree.
$arrowRoot = Join-Path $assetRoot 'arrows'
$written = 0
foreach ($style in $styles) {
    foreach ($colorName in $palette.Keys) {
        $color = [Drawing.ColorTranslator]::FromHtml($palette[$colorName])
        foreach ($weight in $weights) {
            $directory = Join-Path $arrowRoot "$style\$colorName\$weight"
            New-Item -ItemType Directory -Force -Path $directory | Out-Null
            foreach ($maneuver in $maneuvers) {
                $large = [Drawing.Bitmap]::new(($size*$supersample),($size*$supersample))
                $g = [Drawing.Graphics]::FromImage($large)
                $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
                $frame = $artwork.frames.$maneuver
                $scale = [float]($size*$supersample/$frame[2])
                $g.ScaleTransform($scale,$scale)
                $g.TranslateTransform(-[float]$frame[0],-[float]$frame[1])
                Draw-Maneuver $g $maneuver $weight $style $color
                $g.Dispose()
                $bitmap = [Drawing.Bitmap]::new($size,$size)
                $downsample = [Drawing.Graphics]::FromImage($bitmap)
                $downsample.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $downsample.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $downsample.DrawImage($large,0,0,$size,$size)
                $bitmap.Save((Join-Path $directory "$maneuver.png"),[Drawing.Imaging.ImageFormat]::Png)
                $downsample.Dispose(); $bitmap.Dispose(); $large.Dispose()
                $written++
            }
        }
    }
}
$bitmap = [Drawing.Bitmap]::new(112,112)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$pen = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#88958c'),6)
$pen.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
$points = for ($index = 0; $index -lt 32; $index++) {
    $radius = if (($index % 4) -in @(0,3)) { 35 } else { 44 }
    $angle = ($index * 360 / 32) * [Math]::PI / 180
    [Drawing.PointF]::new([float](56+$radius*[Math]::Cos($angle)),[float](56+$radius*[Math]::Sin($angle)))
}
$graphics.DrawPolygon($pen,[Drawing.PointF[]]$points)
$graphics.DrawEllipse($pen,40,40,32,32)
$bitmap.Save((Join-Path $assetRoot 'settings.png'),[Drawing.Imaging.ImageFormat]::Png)
$pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()

Write-Output "Generated $written maneuver assets (${size}px, tight frames, $supersample x antialiasing)."
