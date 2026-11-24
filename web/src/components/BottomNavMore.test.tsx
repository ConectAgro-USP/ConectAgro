import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeAuth, renderWithAuth } from "../test/helpers";
import { BottomNav } from "./BottomNav";

function moreButton(): HTMLElement {
  return screen.getByRole("button", { name: "Mais" });
}

function panel(): HTMLElement {
  return document.getElementById(moreButton().getAttribute("aria-controls")!)!;
}

function renderOpenPanel(url = "/") {
  renderWithAuth(<BottomNav />, fakeAuth({ profileType: "apartment" }), url);
  return userEvent.click(moreButton());
}

describe("BottomNav Mais panel", () => {
  it("starts closed and points the button to the panel", () => {
    renderWithAuth(<BottomNav />, fakeAuth({ profileType: "apartment" }));

    expect(moreButton()).toHaveAttribute("aria-expanded", "false");
    expect(panel()).not.toBeVisible();
  });

  it("opens and moves the focus to the first item", async () => {
    await renderOpenPanel();

    expect(moreButton()).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toBeVisible();
    expect(screen.getByRole("link", { name: "Moradores" })).toHaveFocus();
  });

  it("closes on Escape and gives the focus back to the button", async () => {
    await renderOpenPanel();

    await userEvent.keyboard("{Escape}");

    expect(moreButton()).toHaveAttribute("aria-expanded", "false");
    expect(panel()).not.toBeVisible();
    expect(moreButton()).toHaveFocus();
  });

  it("closes on a click outside and gives the focus back to the button", async () => {
    await renderOpenPanel();

    await userEvent.click(document.body);

    expect(panel()).not.toBeVisible();
    expect(moreButton()).toHaveFocus();
  });

  it("stays open on a click inside", async () => {
    await renderOpenPanel();

    await userEvent.click(panel());

    expect(panel()).toBeVisible();
  });

  it("closes when the button is pressed again", async () => {
    await renderOpenPanel();

    await userEvent.click(moreButton());

    expect(panel()).not.toBeVisible();
    expect(moreButton()).toHaveFocus();
  });

  it("closes after opening one of its pages", async () => {
    await renderOpenPanel();

    await userEvent.click(screen.getByRole("link", { name: "Perfil" }));

    expect(panel()).not.toBeVisible();
    expect(moreButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("highlights Mais while one of its pages is open", () => {
    renderWithAuth(<BottomNav />, fakeAuth({ profileType: "apartment" }), "/moradores");

    expect(moreButton()).toHaveAttribute("data-active");
  });

  it("does not highlight Mais on a page of the bar", () => {
    renderWithAuth(<BottomNav />, fakeAuth({ profileType: "apartment" }), "/compras");

    expect(moreButton()).not.toHaveAttribute("data-active");
  });
});
