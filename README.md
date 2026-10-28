# LocalHub · Local Resources and Software Manager

Collect all the **software**, **folders** and frequently visited **websites** scattered across your hard drive into a single list. When you need them, simply click on them to open them, or press a button to jump directly to the corresponding folder.

**Fully local operation, no need to register an account, and the data does not leave the local machine.**

## Use it

**1. Open** — The first run is empty and the software will not secretly scan your hard drive.

**2. Bring the things in.** — Drag the exe file and folder directly into the window from the Resource Manager, or manually select by clicking on the " + File" and " + Folder" buttons on the toolbar.The same applies to common web addresses: Click on " + URL" to enter it, or simply drag the link icon on the left side of the browser address bar into the window.

**3. Click and it's ready!** —

| Button           | Function                                         |
| -------------- | -------------------------------------------- |
| **Open** | Start the system in the default mode (and open the website using the browser) |
| **Site** | Select it in the Resource Manager and navigate to its location.         |

We suggest creating two categories: one called "Software" and the other "Website". The icons will be automatically read, so you don't need to worry about it.

---

## Why use it

When installing software, it usually defaults to creating a shortcut on the desktop. But after uninstalling it several times, the desktop has become messy. There are also a bunch of green software lying in `D:\a very deep directory`, and every time you want to find them, you have to open the Resource Manager and search through all the contents.

LocalHub eliminates the "search" process altogether: The items are still in their original place, but here we have a list instead.

Function：

- **Category + Subcategory** —— Under "Software", you can further subdivide it into "AI Tools" and "Audio/Video". The hierarchy can be adjusted as you wish.
- **Put the files and the website together** —— Local programs and commonly used websites do not need to be recorded separately in two places.
- **Real icon** —— What is displayed is the icon of the program itself, not the blank white screen given by the system.
- **Just pull it in.** —— There's no need to click "Add" and then go through the table of contents again.
- **Just add a note casually** —— Edit directly within the text, write "What's this for?" and "The password is xxx".
- **Path failure will be marked in red.** —— The file has been moved or deleted. The entry will turn red and the button will be disabled. You won't be able to access it until you try to click it.

---

## Q&A

**Where is the data stored?**
`C:\Users\<your username>\AppData\Roaming\LocalHub\data.json`, the icon cache is stored in the `icon-cache` folder in the same directory.

**Uninstalling the software will not delete this file.**，The list of reinstalled items is still there. If you want to completely clear it, simply delete the entire "LocalHub" folder.

**Will your data be uploaded to the server?**
No. The software has no synchronization logic. The only place it connects to the internet is the icon for fetching website entries - once it is retrieved, it is saved locally and will not make duplicate requests.

---

## Update

The detailed breakdown of each modification can be viewed by clicking on the version number at the bottom left of the sidebar in the software.
