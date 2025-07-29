@echo off
echo 开始下载 FFmpeg...

:: 创建 ffmpeg 目录
if not exist "ffmpeg" mkdir ffmpeg

:: 下载 FFmpeg
powershell -Command "& {Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile 'ffmpeg.zip'}"

echo 下载完成，开始解压...

:: 解压到 ffmpeg 目录
powershell -Command "& {Expand-Archive -Path 'ffmpeg.zip' -DestinationPath 'ffmpeg' -Force}"

echo 解压完成，查找 ffmpeg.exe...

:: 查找并复制 ffmpeg.exe
for /r "ffmpeg" %%i in (ffmpeg.exe) do (
    echo 找到 ffmpeg.exe: %%i
    copy "%%i" "ffmpeg.exe" /Y
    if exist "ffmpeg.exe" (
        echo 复制成功！
        goto :found
    ) else (
        echo 复制失败！
    )
)

:found
echo FFmpeg 设置完成！

:: 清理临时文件
if exist "ffmpeg.zip" del ffmpeg.zip
if exist "ffmpeg" rmdir /s /q ffmpeg

echo 清理完成！
pause 