# Own your family tree

A **local-first** family tree viewer: plain HTML + CSS + JS.
**no server, no build step**.
Designed to be opened by clicking family-tree.html.

Design decisions:
- Local first. Self contained inside a folder/directory.
- Runs on a browser without a server.
- The folder is copyable to facilitate permanent storage and sharing (e.g. via SD card)
- Supports rich media: audio, photo, video, links and informational texts.
- No build/compile step

# To Do

- Better experience in mobile:
    - Potentially: generate single HTML file that can be shared on messaging apps. Currently we have different files for tree and detail page, each with its own .css and .js files but that makes things harder for mobile sharing.
        - include CSS, JS
        - inclde photos - perhaps embed as Data URIs in the HTML file but seems browser have some limitations when reading the photo files in order to get the bytes
        - move detail.html into family-tree.html as a pop-up instead

# License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.