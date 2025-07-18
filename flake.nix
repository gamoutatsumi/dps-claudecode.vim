{
  description = "Default Flake";

  inputs = {
    # keep-sorted start block=yes
    flake-checker = {
      url = "github:DeterminateSystems/flake-checker";
      inputs = {
        nixpkgs = {
          follows = "nixpkgs";
        };
      };
    };
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs = {
        nixpkgs-lib = {
          follows = "nixpkgs";
        };
      };
    };
    mcp-servers-nix = {
      url = "github:natsukium/mcp-servers-nix";
      inputs = {
        nixpkgs = {
          follows = "nixpkgs";
        };
      };
    };
    nixpkgs = {
      url = "https://nixos.org/channels/nixos-unstable/nixexprs.tar.xz";
    };
    pre-commit-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs = {
        nixpkgs = {
          follows = "nixpkgs";
        };
      };
    };
    systems = {
      url = "github:nix-systems/default";
    };
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs = {
        nixpkgs = {
          follows = "nixpkgs";
        };
      };
    };
    # keep-sorted end
  };

  outputs =
    {
      flake-parts,
      systems,
      flake-checker,
      ...
    }@inputs:
    flake-parts.lib.mkFlake { inherit inputs; } (
      {
        inputs,
        ...
      }:
      {
        systems = import systems;
        imports = [
          inputs.pre-commit-hooks.flakeModule
          inputs.treefmt-nix.flakeModule
        ];

        perSystem =
          {
            system,
            pkgs,
            config,
            inputs',
            lib,
            ...
          }:
          let
            treefmtBuild = config.treefmt.build;
            mcpJson = inputs.mcp-servers-nix.lib.mkConfig pkgs {
              format = "json";
              flavor = "claude";
              programs = {
                git = {
                  enable = true;
                };
                sequential-thinking = {
                  enable = true;
                };
                context7 = {
                  enable = true;
                };
              };
              settings = {
                servers = {
                  github-server = {
                    type = "http";
                    url = "https://api.githubcopilot.com/mcp";
                  };
                };
              };
            };
          in
          {
            _module = {
              args = {
                pkgs = import inputs.nixpkgs {
                  inherit system;
                  config = {
                    allowUnfree = true;
                  };
                };
              };
            };
            checks = config.packages;
            devShells = {
              default = pkgs.mkShell {
                shellHook = ''
                  GIT_WC=`${lib.getExe pkgs.git} rev-parse --show-toplevel`
                  ln -sf ${mcpJson} ''${GIT_WC}/.mcp.json
                '';
                PFPATH = "${
                  pkgs.buildEnv {
                    name = "zsh-comp";
                    paths = config.devShells.default.nativeBuildInputs;
                    pathsToLink = [ "/share/zsh" ];
                  }
                }/share/zsh/site-functions";
                packages = with pkgs; [
                  hello
                ];
                inputsFrom = [
                  config.pre-commit.devShell
                  treefmtBuild.devShell
                ];
              };
            };
            pre-commit = {
              check = {
                enable = true;
              };
              settings = {
                src = ./.;
                hooks = {
                  # keep-sorted start block=yes
                  flake-checker = {
                    enable = true;
                    package = inputs'.flake-checker.packages.flake-checker;
                  };
                  treefmt = {
                    enable = true;
                    packageOverrides = {
                      treefmt = treefmtBuild.wrapper;
                    };
                  };
                  # keep-sorted end
                };
              };
            };
            formatter = treefmtBuild.wrapper;
            treefmt = {
              projectRootFile = "flake.nix";
              flakeCheck = false;
              programs = {
                # keep-sorted start block=yes
                deadnix = {
                  enable = true;
                };
                keep-sorted = {
                  enable = true;
                };
                nixfmt = {
                  enable = true;
                };
                statix = {
                  enable = true;
                };
                # keep-sorted end
              };
            };
          };
      }
    );
}
